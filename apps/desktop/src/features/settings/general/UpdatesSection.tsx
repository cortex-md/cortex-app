import { Button, Progress } from "@cortex/ui"
import { Download, RefreshCw } from "lucide-react"
import { useEffect } from "react"
import { formatBytes, formatDateTime } from "@/utils/format"
import {
	checkForAppUpdate,
	installPendingAppUpdate,
	refreshAppUpdateStatus,
	useAppUpdateSnapshot,
} from "../../app-updates/appUpdateStore"
import { SettingsGroup, SettingsGroupContent, SettingsSection } from "../SettingsPrimitives"

const appUpdateStateLabels = {
	idle: "Not checked yet",
	checking: "Checking for updates",
	"up-to-date": "Cortex is up to date",
	available: "Update available",
	installing: "Installing update",
	installed: "Update installed",
	error: "Update check failed",
	unsupported: "Updates unavailable",
} as const

function formatLastChecked(value: string | null): string {
	return value ? formatDateTime(value) : "Never"
}

function getInstallLabel(): string {
	return document.body.dataset.platform === "windows" ? "Install" : "Install and restart"
}

function handleCheckForUpdates(): void {
	void checkForAppUpdate("manual")
}

function handleInstallPendingUpdate(): void {
	void installPendingAppUpdate()
}

export function UpdatesSection() {
	const updateStatus = useAppUpdateSnapshot()
	const pendingUpdate = updateStatus.pendingUpdate
	const checking = updateStatus.state === "checking"
	const installing = updateStatus.state === "installing"
	const progress =
		updateStatus.contentLength && updateStatus.contentLength > 0
			? Math.min(100, Math.round((updateStatus.downloaded / updateStatus.contentLength) * 100))
			: null

	useEffect(() => {
		void refreshAppUpdateStatus()
	}, [])

	return (
		<SettingsSection
			fieldId="general.updates"
			title="Updates"
			description="Signed desktop updates from stable GitHub releases."
		>
			<SettingsGroup>
				<SettingsGroupContent className="flex flex-col gap-3">
					<div className="flex min-w-0 flex-col gap-1">
						<p className="m-0 text-[13px] font-semibold text-foreground">
							{appUpdateStateLabels[updateStatus.state]}
						</p>
						<p className="m-0 text-xs leading-[18px] text-muted-foreground">
							Current version {updateStatus.currentVersion ?? "unknown"} · Last checked{" "}
							{formatLastChecked(updateStatus.lastCheckedAt)}
						</p>
						{pendingUpdate && (
							<p className="m-0 text-xs leading-[18px] text-muted-foreground">
								Version {pendingUpdate.version} is ready for this device.
							</p>
						)}
						{updateStatus.lastError && (
							<p className="m-0 text-xs leading-[18px] text-destructive">
								{updateStatus.lastError}
							</p>
						)}
					</div>

					{installing && (
						<div className="flex flex-col gap-1.5">
							<Progress value={progress ?? 8} />
							<p className="m-0 text-xs text-muted-foreground">
								{progress === null
									? "Downloading update"
									: `${formatBytes(updateStatus.downloaded)} of ${formatBytes(
											updateStatus.contentLength ?? 0,
										)}`}
							</p>
						</div>
					)}

					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="secondary"
							size="sm"
							onClick={handleCheckForUpdates}
							disabled={checking || installing}
						>
							<RefreshCw className={checking ? "animate-spin" : ""} />
							Check for updates
						</Button>
						{pendingUpdate && (
							<Button
								size="sm"
								onClick={handleInstallPendingUpdate}
								disabled={checking || installing}
							>
								<Download />
								{getInstallLabel()}
							</Button>
						)}
					</div>
				</SettingsGroupContent>
			</SettingsGroup>
		</SettingsSection>
	)
}
