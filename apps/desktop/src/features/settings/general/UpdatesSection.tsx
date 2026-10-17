import type { AppUpdateStatus } from "@cortex/platform"
import { useSettingsStore } from "@cortex/settings"
import { Button, Progress, Switch } from "@cortex/ui"
import { Download, ExternalLink, FolderInput, RefreshCw, RotateCw } from "lucide-react"
import { useEffect } from "react"
import { formatBytes, formatDateTime } from "@/utils/format"
import {
	APP_UPDATE_STATE_LABELS,
	canMoveToApplications,
	getDownloadProgress,
	isAppUpdateBusy,
	needsManualInstall,
	openAppUpdateDownloadPage,
} from "../../app-updates/appUpdatePresentation"
import {
	checkForAppUpdate,
	downloadAppUpdate,
	installAppUpdateNow,
	moveAppToApplications,
	refreshAppUpdateStatus,
	setAppUpdateInstallOnQuit,
	useAppUpdateSnapshot,
} from "../../app-updates/appUpdateStore"
import { DesktopSelect } from "../desktopSettingsControlComponents"
import {
	SettingsField,
	SettingsGroup,
	SettingsGroupContent,
	SettingsSection,
} from "../SettingsPrimitives"

const CHANNEL_OPTIONS = [
	{ value: "stable", label: "Stable" },
	{ value: "beta", label: "Beta" },
] as const

function formatLastChecked(value: string | null): string {
	return value ? formatDateTime(value) : "Never"
}

function handleCheckForUpdates(): void {
	void checkForAppUpdate("manual")
}

function handleDownload(): void {
	void downloadAppUpdate()
}

function handleRestartNow(): void {
	void installAppUpdateNow()
}

function handleMoveToApplications(): void {
	void moveAppToApplications()
}

function handleAutoCheckChange(checked: boolean): void {
	void useSettingsStore.getState().updateSetting("updates", "autoCheck", checked)
}

function handleChannelChange(value: string): void {
	void useSettingsStore
		.getState()
		.updateSetting("updates", "channel", value === "beta" ? "beta" : "stable")
}

function handleInstallOnQuitChange(checked: boolean): void {
	void setAppUpdateInstallOnQuit(checked)
}

function describePendingUpdate(status: AppUpdateStatus): string | null {
	const version = status.pendingUpdate?.version
	if (!version) return null
	if (status.state === "ready") return `Version ${version} is downloaded and verified.`
	if (needsManualInstall(status)) return `Version ${version} is available to download.`
	return `Version ${version} is available.`
}

function UpdateStatusSummary({ status }: { status: AppUpdateStatus }) {
	const pendingDescription = describePendingUpdate(status)
	const errorTone = status.state === "error" ? "text-destructive" : "text-muted-foreground"
	return (
		<div className="flex min-w-0 flex-col gap-1">
			<p className="m-0 text-[13px] font-semibold text-foreground">
				{APP_UPDATE_STATE_LABELS[status.state]}
			</p>
			<p className="m-0 text-xs leading-[18px] text-muted-foreground">
				Current version {status.currentVersion ?? "unknown"} · Last checked{" "}
				{formatLastChecked(status.lastCheckedAt)}
			</p>
			{pendingDescription && (
				<p className="m-0 text-xs leading-[18px] text-muted-foreground">{pendingDescription}</p>
			)}
			{status.lastError && (
				<p className={`m-0 text-xs leading-[18px] ${errorTone}`}>{status.lastError.message}</p>
			)}
		</div>
	)
}

function UpdateDownloadProgress({ status }: { status: AppUpdateStatus }) {
	const progress = getDownloadProgress(status)
	return (
		<div className="flex flex-col gap-1.5">
			<Progress value={progress ?? 8} />
			<p className="m-0 text-xs text-muted-foreground">
				{progress === null
					? APP_UPDATE_STATE_LABELS[status.state]
					: `${formatBytes(status.downloaded)} of ${formatBytes(status.contentLength ?? 0)}`}
			</p>
		</div>
	)
}

function UpdateActions({ status }: { status: AppUpdateStatus }) {
	const ready = status.state === "ready"
	const available = status.state === "available"
	const manual = needsManualInstall(status)
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Button
				variant="secondary"
				onClick={handleCheckForUpdates}
				disabled={isAppUpdateBusy(status)}
			>
				<RefreshCw className={status.state === "checking" ? "animate-spin" : ""} />
				Check for updates
			</Button>
			{available && !manual && (
				<Button onClick={handleDownload}>
					<Download />
					Download
				</Button>
			)}
			{ready && (
				<Button onClick={handleRestartNow}>
					<RotateCw />
					{manual ? "Show update" : "Restart now"}
				</Button>
			)}
			{available && manual && (
				<Button onClick={() => openAppUpdateDownloadPage(status)}>
					<ExternalLink />
					Download page
				</Button>
			)}
			{canMoveToApplications(status) && (
				<Button variant="outline" onClick={handleMoveToApplications}>
					<FolderInput />
					Move to Applications
				</Button>
			)}
		</div>
	)
}

export function UpdatesSection() {
	const updateStatus = useAppUpdateSnapshot()
	const autoCheck = useSettingsStore((state) => state.settings.updates.autoCheck)
	const channel = useSettingsStore((state) => state.settings.updates.channel)
	const downloading = updateStatus.state === "downloading" || updateStatus.state === "verifying"
	const canInstallOnQuit = updateStatus.state === "ready" && !needsManualInstall(updateStatus)

	useEffect(() => {
		void refreshAppUpdateStatus()
	}, [])

	return (
		<SettingsSection fieldId="general.updates" title="Updates">
			<SettingsGroup>
				<SettingsGroupContent className="flex flex-col gap-3">
					<UpdateStatusSummary status={updateStatus} />
					{downloading && <UpdateDownloadProgress status={updateStatus} />}
					<UpdateActions status={updateStatus} />
				</SettingsGroupContent>
				<SettingsField fieldId="general.updates-auto-check" htmlFor="updates-auto-check">
					<Switch
						id="updates-auto-check"
						checked={autoCheck}
						onCheckedChange={handleAutoCheckChange}
					/>
				</SettingsField>
				{canInstallOnQuit && (
					<SettingsField label="Install when Cortex quits" htmlFor="updates-install-on-quit">
						<Switch
							id="updates-install-on-quit"
							checked={updateStatus.installOnQuit}
							onCheckedChange={handleInstallOnQuitChange}
						/>
					</SettingsField>
				)}
				<SettingsField fieldId="general.updates-channel">
					<DesktopSelect value={channel} onChange={handleChannelChange} options={CHANNEL_OPTIONS} />
				</SettingsField>
			</SettingsGroup>
		</SettingsSection>
	)
}
