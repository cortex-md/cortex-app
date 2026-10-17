import type { VaultMetadata } from "@cortex/core"
import { sendCoreNotification } from "@cortex/core"
import { type AppUpdateStatus, getPlatform } from "@cortex/platform"
import { useSettingsStore } from "@cortex/settings"
import { useEffect, useRef } from "react"
import {
	readLastSeenAppVersion,
	writeLastSeenAppVersion,
} from "../features/app-updates/appUpdateChangelogMarker"
import {
	configureAppUpdates,
	refreshAppUpdateStatus,
	startAppUpdateSync,
	useAppUpdateSelector,
} from "../features/app-updates/appUpdateStore"
import { openChangelogTab } from "../features/app-updates/openChangelog"

function selectReadyVersion(status: AppUpdateStatus): string | null {
	return status.state === "ready" ? (status.pendingUpdate?.version ?? null) : null
}

export function useAppUpdateLifecycle(version: string | null, vault: VaultMetadata | null) {
	const autoCheck = useSettingsStore((state) => state.settings.updates.autoCheck)
	const channel = useSettingsStore((state) => state.settings.updates.channel)
	const handledChangelogVersions = useRef<Set<string> | null>(null)
	handledChangelogVersions.current ??= new Set()

	useEffect(() => {
		const stopSync = startAppUpdateSync()
		void refreshAppUpdateStatus()
		return stopSync
	}, [])

	useEffect(() => {
		void configureAppUpdates({ autoCheck, channel })
	}, [autoCheck, channel])

	const readyVersion = useAppUpdateSelector(selectReadyVersion)
	useEffect(() => {
		if (!readyVersion) return
		void getPlatform()
			.window.claimOnce(`app-update-ready:${readyVersion}`)
			.then((claimed) => {
				if (!claimed) return
				void sendCoreNotification({
					id: `app-update-ready:${readyVersion}`,
					tag: "app-update",
					title: `Cortex ${readyVersion} is ready`,
					body: "It installs the next time you quit Cortex.",
					kind: "info",
					urgency: "low",
				})
			})
	}, [readyVersion])

	useEffect(() => {
		if (!version || !vault) return
		if (handledChangelogVersions.current?.has(version)) return
		let cancelled = false
		handledChangelogVersions.current?.add(version)

		const openChangelog = async () => {
			const lastSeenVersion = await readLastSeenAppVersion()
			if (cancelled || lastSeenVersion === version) return
			if (!(await getPlatform().window.claimOnce(`app-update-changelog:${version}`))) return

			const opened = await openChangelogTab(version)
			if (cancelled) return

			void sendCoreNotification({
				id: `app-updated:${version}`,
				tag: "app-update",
				title: `Cortex updated to v${version}`,
				body: opened ? "Release notes are open in Cortex." : undefined,
				kind: "success",
				urgency: "normal",
			})

			try {
				await writeLastSeenAppVersion(version)
			} catch (error) {
				console.error("[App update changelog marker write failed]", { version, error })
			}
		}

		void openChangelog().catch((error) => {
			console.error("[App update changelog handling failed]", { version, error })
		})

		return () => {
			cancelled = true
		}
	}, [vault, version])
}
