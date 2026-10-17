import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import type {
	AppUpdateCheckSource,
	AppUpdatePreferences,
	AppUpdateState,
	AppUpdateStatus,
} from "@cortex/platform"
import { app, net, powerMonitor } from "electron"
import { runBeforeInstallHooks } from "../shutdownHooks"
import { detectCurrentInstallType, userCacheDir } from "./currentInstall"
import { downloadVerified } from "./download"
import { toUpdateError, UpdateError } from "./errors"
import { createInstaller, type PreparedUpdate, type UpdateInstaller } from "./installers"
import { describeInstallType, type InstallType } from "./installType"
import {
	isTrustedReleaseUrl,
	releasePageUrl,
	selectPlatformPackage,
	type UpdateManifest,
	type UpdatePackage,
} from "./manifest"
import { UPDATE_PUBLIC_KEY } from "./publicKey"
import { importPublicKey } from "./signature"
import { fetchSignedManifest, isTrustedResponseUrl } from "./source"
import {
	cleanStaging,
	newestStagedVersion,
	readPreparedPackage,
	type StagingLayout,
	stagingLayoutFor,
	writePreparedMarker,
} from "./staging"
import { isNewerVersion } from "./version"

const FIRST_CHECK_DELAY_MS = 10_000
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const HOOK_TIMEOUT_MS = 5_000

const BUSY_STATES: ReadonlySet<AppUpdateState> = new Set([
	"checking",
	"downloading",
	"verifying",
	"installing",
])

interface PendingRelease {
	manifest: UpdateManifest
	entry: UpdatePackage | null
	installer: UpdateInstaller
	prepared: PreparedUpdate | null
}

export class Updater {
	private status: AppUpdateStatus = {
		state: "idle",
		currentVersion: app.getVersion(),
		pendingUpdate: null,
		lastCheckedAt: null,
		lastError: null,
		installMode: "automatic",
		installOnQuit: true,
		downloaded: 0,
		contentLength: null,
	}
	private preferences: AppUpdatePreferences = { autoCheck: true, channel: "stable" }
	private pending: PendingRelease | null = null
	private readonly listeners = new Set<(status: AppUpdateStatus) => void>()
	private readonly installType: InstallType
	private readonly staging: StagingLayout
	private checkTimer: NodeJS.Timeout | null = null
	private started = false
	private installing = false
	private waitingForPower = false

	constructor() {
		this.installType = detectCurrentInstallType()
		this.staging = stagingLayoutFor(this.installType, app.getPath("userData"), userCacheDir())
		const installer = createInstaller(this.installType)
		this.status.installMode = installer.mode
		console.info(
			`[updates] ${process.platform}-${process.arch} install=${describeInstallType(this.installType)} mode=${this.status.installMode}`,
		)
	}

	getStatus(): AppUpdateStatus {
		return { ...this.status }
	}

	onStatusChanged(listener: (status: AppUpdateStatus) => void): () => void {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}

	private update(patch: Partial<AppUpdateStatus>): AppUpdateStatus {
		const previous = this.status.state
		this.status = { ...this.status, ...patch }
		if (patch.state && patch.state !== previous) {
			const error = this.status.lastError
			console.info(
				`[updates] ${previous} -> ${patch.state}${error && patch.state === "error" ? ` (${error.code}: ${error.message})` : ""}`,
			)
		}
		const snapshot = this.getStatus()
		for (const listener of this.listeners) listener(snapshot)
		return snapshot
	}

	private fail(error: unknown, fallback: UpdateError["code"]): AppUpdateStatus {
		const updateError = toUpdateError(error, fallback)
		return this.update({
			state: "error",
			lastError: { code: updateError.code, message: updateError.message },
		})
	}

	configure(preferences: AppUpdatePreferences): AppUpdateStatus {
		const channelChanged = preferences.channel !== this.preferences.channel
		this.preferences = { ...preferences }
		if (channelChanged && !this.installing && this.status.state !== "ready") this.pending = null
		this.reschedule()
		return this.getStatus()
	}

	/** Called once after the first window is visible so the check never competes with startup. */
	start(): void {
		if (this.started) return
		this.started = true
		powerMonitor.on("resume", this.handleResume)
		powerMonitor.on("on-ac", this.handleOnAc)
		this.reschedule()
		void newestStagedVersion(this.staging, app.getVersion()).then((keep) => this.cleanStaging(keep))
	}

	/** One timer: the next check is due 6 h after the last one, or shortly after startup. */
	private reschedule(): void {
		if (this.checkTimer) clearTimeout(this.checkTimer)
		this.checkTimer = null
		if (!this.started || !this.preferences.autoCheck) return
		const lastCheckedAt = this.status.lastCheckedAt ? Date.parse(this.status.lastCheckedAt) : null
		const delay =
			lastCheckedAt === null
				? FIRST_CHECK_DELAY_MS
				: Math.max(FIRST_CHECK_DELAY_MS, lastCheckedAt + CHECK_INTERVAL_MS - Date.now())
		this.checkTimer = setTimeout(() => {
			this.checkTimer = null
			void this.check(lastCheckedAt === null ? "startup" : "scheduled").finally(() =>
				this.reschedule(),
			)
		}, delay)
	}

	private readonly handleResume = () => this.reschedule()

	private readonly handleOnAc = () => {
		if (!this.waitingForPower || !this.preferences.autoCheck || this.status.state !== "available") {
			return
		}
		console.info("[updates] on AC power, starting the deferred download")
		void this.download()
	}

	private cleanStaging(keepVersion: string | null): Promise<void> {
		return cleanStaging(this.staging, keepVersion).then(
			(removed) => {
				if (removed.length > 0)
					console.info(`[updates] removed ${removed.length} stale update files`)
			},
			(error) => console.warn("[updates] failed to clean staging:", error),
		)
	}

	private publicKeyFor() {
		const key = UPDATE_PUBLIC_KEY
		if (!key) throw new UpdateError("SIGNATURE_INVALID", "This build has no update signing key")
		return importPublicKey(key)
	}

	async check(source: AppUpdateCheckSource): Promise<AppUpdateStatus> {
		if (BUSY_STATES.has(this.status.state) || this.status.state === "ready") {
			return this.getStatus()
		}
		if (this.status.installMode === "unsupported") {
			return this.update({ state: "unsupported", lastError: null })
		}
		const startedAt = Date.now()
		this.update({ state: "checking", lastError: null })
		let manifest: UpdateManifest
		try {
			manifest = await fetchSignedManifest({
				channel: this.preferences.channel,
				fetch: (input, init) => net.fetch(input, init),
				publicKey: this.publicKeyFor(),
				allowUrl: isTrustedReleaseUrl,
				allowResponseUrl: isTrustedResponseUrl,
			})
		} catch (error) {
			this.status.lastCheckedAt = new Date().toISOString()
			return this.fail(error, "NETWORK")
		}
		const currentVersion = app.getVersion()
		const lastCheckedAt = new Date().toISOString()
		console.info(
			`[updates] ${source} check found ${manifest.version} (current ${currentVersion}) in ${Date.now() - startedAt} ms`,
		)
		if (!isNewerVersion(manifest.version, currentVersion)) {
			this.pending = null
			void this.cleanStaging(null)
			return this.update({ state: "up-to-date", pendingUpdate: null, lastCheckedAt })
		}

		let release: PendingRelease
		try {
			release = await this.prepareRelease(manifest)
		} catch (error) {
			this.status.lastCheckedAt = lastCheckedAt
			return this.fail(error, "INSTALL_FAILED")
		}
		this.pending = release
		void this.cleanStaging(release.installer.downloads ? manifest.version : null)
		const notice = release.installer.mode === "automatic" ? null : this.status.lastError
		this.update({
			state: "available",
			lastCheckedAt,
			lastError: notice,
			installMode: release.installer.mode,
			downloaded: 0,
			contentLength: release.entry?.size ?? null,
			pendingUpdate: {
				version: manifest.version,
				currentVersion,
				body: manifest.notes || null,
				date: manifest.releasedAt,
				target: `${process.platform}-${process.arch}`,
				downloadUrl: releasePageUrl(manifest.version),
			},
		})
		if (!release.installer.downloads) return this.getStatus()
		if (source === "manual") return await this.download()
		if (!this.preferences.autoCheck) return this.getStatus()
		if (powerMonitor.isOnBatteryPower()) {
			this.waitingForPower = true
			console.info("[updates] on battery, the download waits for AC power")
			return this.getStatus()
		}
		return await this.download()
	}

	private async prepareRelease(manifest: UpdateManifest): Promise<PendingRelease> {
		const installer = createInstaller(this.installType)
		if (!installer.downloads) {
			this.status.lastError = null
			return { manifest, entry: null, installer, prepared: null }
		}
		const entry = selectPlatformPackage(manifest, process.platform, process.arch)
		try {
			await installer.preflight()
			this.status.lastError = null
			return { manifest, entry, installer, prepared: null }
		} catch (error) {
			const updateError = toUpdateError(error, "INSTALL_FAILED")
			if (
				updateError.code !== "NO_WRITE_PERMISSION" &&
				updateError.code !== "NOT_IN_APPLICATIONS"
			) {
				throw updateError
			}
			console.info(`[updates] ${updateError.code}: falling back to a manual install`)
			this.status.lastError = { code: updateError.code, message: updateError.message }
			const fallback = createInstaller(this.installType, false)
			return {
				manifest,
				entry: fallback.downloads ? entry : null,
				installer: fallback,
				prepared: null,
			}
		}
	}

	async download(): Promise<AppUpdateStatus> {
		const release = this.pending
		if (!release?.entry || !release.installer.downloads) return this.getStatus()
		if (BUSY_STATES.has(this.status.state) || release.prepared) return this.getStatus()
		const entry = release.entry
		const version = release.manifest.version
		const context = { version, stagingDir: join(this.staging.root, version), pid: process.pid }
		const notice = this.status.lastError
		const startedAt = Date.now()
		this.waitingForPower = false
		const preparedPath = await readPreparedPackage(context.stagingDir, version, entry)
		if (preparedPath) {
			release.prepared = { packagePath: preparedPath, version }
			console.info(`[updates] ${version} was already downloaded and verified`)
			return this.update({
				state: "ready",
				lastError: notice,
				installOnQuit: release.installer.mode === "automatic",
			})
		}
		this.update({ state: "downloading", downloaded: 0, contentLength: entry.size })
		try {
			await mkdir(context.stagingDir, { recursive: true })
			const result = await downloadVerified({
				url: entry.url,
				destination: release.installer.downloadPath(entry, context),
				sha256: entry.sha256,
				size: entry.size,
				fetch: (input, init) => net.fetch(input, init),
				allowResponseUrl: isTrustedResponseUrl,
				onProgress: ({ downloaded, total }) => this.update({ downloaded, contentLength: total }),
			})
			console.info(
				`[updates] downloaded ${version} in ${Date.now() - startedAt} ms (resumed from ${result.resumedFrom}, reused ${result.reused})`,
			)
			this.update({ state: "verifying" })
			const verifyStartedAt = Date.now()
			release.prepared = await release.installer.prepare(result.path, context)
			await writePreparedMarker(context.stagingDir, {
				version,
				sha256: entry.sha256,
				size: entry.size,
				preparedPath: release.prepared.packagePath,
			})
			console.info(`[updates] prepared ${version} in ${Date.now() - verifyStartedAt} ms`)
		} catch (error) {
			return this.fail(error, "NETWORK")
		}
		if (this.pending !== release) return this.getStatus()
		return this.update({
			state: "ready",
			lastError: notice,
			installOnQuit: release.installer.mode === "automatic",
		})
	}

	setInstallOnQuit(enabled: boolean): AppUpdateStatus {
		return this.update({ installOnQuit: enabled })
	}

	/** Returns true when the app should quit now. */
	private async install(): Promise<boolean> {
		const release = this.pending
		if (!release || this.installing) return false
		if (!release.installer.downloads) {
			await release.installer.install(
				{ packagePath: "", version: release.manifest.version },
				{
					version: release.manifest.version,
					stagingDir: this.staging.root,
					pid: process.pid,
				},
			)
			return false
		}
		if (!release.prepared) return false
		this.installing = true
		const previousState = this.status.state
		this.update({ state: "installing", lastError: null })
		try {
			const failures = await runBeforeInstallHooks("flush", HOOK_TIMEOUT_MS)
			if (failures.length > 0) {
				throw new UpdateError(
					"INSTALL_FAILED",
					`Cortex could not save everything before installing: ${failures.map((failure) => failure.message).join("; ")}`,
				)
			}
			const { quit } = await release.installer.install(release.prepared, {
				version: release.manifest.version,
				stagingDir: join(this.staging.root, release.manifest.version),
				pid: process.pid,
			})
			if (!quit) {
				this.installing = false
				this.update({ state: previousState })
				return false
			}
			await runBeforeInstallHooks("teardown", HOOK_TIMEOUT_MS)
			console.info(
				`[updates] handing off to ${release.installer.kind} for ${release.manifest.version}`,
			)
			return true
		} catch (error) {
			this.installing = false
			this.fail(error, "INSTALL_FAILED")
			this.update({ state: "ready" })
			return false
		}
	}

	async installNow(): Promise<AppUpdateStatus> {
		if (await this.install()) setImmediate(() => app.quit())
		return this.getStatus()
	}

	/** `before-quit` hook: installs a ready update instead of a plain quit when the user opted in. */
	shouldInstallOnQuit(): boolean {
		return (
			!this.installing &&
			this.status.state === "ready" &&
			this.status.installOnQuit &&
			this.status.installMode === "automatic" &&
			this.pending?.prepared !== null
		)
	}

	async installOnQuit(): Promise<void> {
		await this.install()
	}
}
