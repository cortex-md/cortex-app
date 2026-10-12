import {
	formatLastSyncedAt,
	formatRelativeTime,
	SYNC_STATUS_PRESENTATION,
	useDevicesStore,
	useEditorStore,
	useRemoteVaultStore,
	useUIStore,
} from "@cortex/core"
import type { SyncEngineState } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { Button, Switch } from "@cortex/ui"
import {
	ChevronRightIcon,
	Cloud,
	CloudCheck,
	CloudOff,
	HistoryIcon,
	LaptopIcon,
	Link,
	ScrollTextIcon,
	ServerIcon,
	SmartphoneIcon,
	Trash2Icon,
} from "lucide-react"
import { useState } from "react"
import { runInMainWindow } from "../../../windows/runInMainWindow"
import { SettingsField, SettingsGroup, SettingsPage, SettingsSection } from "../SettingsPrimitives"
import { SignedOutNotice } from "./SignedOutNotice"
import { SubscriptionRequiredNotice } from "./SubscriptionRequiredNotice"

const statusToneClassNames = {
	success: "bg-status-success-foreground",
	warning: "bg-status-warning-foreground",
	error: "bg-status-error-foreground",
	muted: "bg-muted-foreground",
} as const

interface SyncOverviewProps {
	authenticated: boolean
	connectedDeviceCount: number
	devicesError: string | null
	devicesLoading: boolean
	engineState: SyncEngineState
	lastSyncedAt: number | null
	linkedVaultId: string | null
	noteCount: number
	remoteVaultRole?: string
	serverLabel: string
	vaultName: string
	vaultPath?: string
	syncEnabled: boolean
	onOpenLink(): void
}

function SyncToggleSection({
	authenticated,
	syncEnabled,
	vaultPath,
}: Pick<SyncOverviewProps, "authenticated" | "syncEnabled" | "vaultPath">) {
	const setSyncEnabled = useRemoteVaultStore((state) => state.setSyncEnabled)
	const [toggleError, setToggleError] = useState<string | null>(null)
	return (
		<section className="settings-section">
			<SettingsGroup>
				<SettingsField
					fieldId="sync.enabled"
					htmlFor="sync-enabled"
					description={
						authenticated ? "Pause without unlinking the remote vault." : "Sign in to enable sync"
					}
				>
					<Switch
						id="sync-enabled"
						size="sm"
						checked={syncEnabled}
						disabled={!authenticated}
						onCheckedChange={(checked) => {
							if (!vaultPath) return
							setToggleError(null)
							void setSyncEnabled(vaultPath, checked).catch((error) => {
								setToggleError(error instanceof Error ? error.message : String(error))
							})
						}}
					/>
				</SettingsField>
			</SettingsGroup>
			{toggleError && <p className="settings-section-error">{toggleError}</p>}
		</section>
	)
}

function SyncStatusHero({
	vaultName,
	serverLabel,
	remoteVaultRole,
	engineState,
	lastSyncedAt,
	connectedDeviceCount,
	devicesLoading,
	noteCount,
}: Pick<
	SyncOverviewProps,
	| "vaultName"
	| "serverLabel"
	| "remoteVaultRole"
	| "engineState"
	| "lastSyncedAt"
	| "connectedDeviceCount"
	| "devicesLoading"
	| "noteCount"
>) {
	const status = SYNC_STATUS_PRESENTATION[engineState]
	const syncing = engineState === "syncing" || engineState === "connecting"
	const title = engineState === "live" ? `${vaultName} is up to date` : vaultName
	const lastSynced = formatLastSyncedAt(lastSyncedAt)
	return (
		<div className="settings-sync-hero" data-tone={status.tone}>
			<span className="settings-sync-hero-icon">
				{status.tone === "success" ? <CloudCheck /> : <Cloud />}
			</span>
			<div className="settings-sync-hero-copy">
				<b title={vaultName}>{title}</b>
				<span>
					<span className={`settings-sync-dot ${statusToneClassNames[status.tone]}`} />
					<span>
						{status.label} {lastSynced.charAt(0).toLowerCase() + lastSynced.slice(1)}
					</span>
					<span aria-hidden="true">·</span>
					<span>{serverLabel}</span>
				</span>
			</div>
			<Button
				variant="secondary"
				size="sm"
				disabled={syncing}
				onClick={() => runInMainWindow("restartSync")}
			>
				{syncing ? "Syncing..." : "Sync now"}
			</Button>
			<div className="settings-sync-stats">
				<div>
					<b>{noteCount.toLocaleString()}</b>
					<span>Notes synced</span>
				</div>
				<div>
					<b>{devicesLoading ? "–" : connectedDeviceCount}</b>
					<span>Devices</span>
				</div>
				<div>
					<b className="capitalize">{remoteVaultRole ?? "Member"}</b>
					<span>Your access</span>
				</div>
			</div>
		</div>
	)
}

export function VaultLinkSection({
	linkedVaultId,
	vaultName,
	serverLabel,
	devicesError,
	onOpenLink,
}: Pick<SyncOverviewProps, "linkedVaultId" | "vaultName" | "devicesError" | "onOpenLink"> & {
	serverLabel?: string
}) {
	return (
		<SettingsSection
			fieldId="sync.remote-vault"
			title="Remote vault"
			footer={devicesError ?? undefined}
		>
			<SettingsGroup>
				{linkedVaultId ? (
					<SettingsField
						icon={<Cloud />}
						label={<span title={vaultName}>{vaultName}</span>}
						description="Linked remote vault"
					>
						<Button variant="ghost" size="xs" onClick={onOpenLink}>
							Change
						</Button>
					</SettingsField>
				) : (
					<SettingsField
						icon={<CloudOff />}
						label="Link or create a remote vault to start syncing."
					>
						<Button variant="default" size="sm" onClick={onOpenLink}>
							<Link />
							Link vault
						</Button>
					</SettingsField>
				)}
				{linkedVaultId && serverLabel && (
					<SettingsField icon={<ServerIcon />} label="Server">
						<span className="settings-field-value">{serverLabel}</span>
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label="Server settings"
							onClick={() => useUIStore.getState().openSettings("sync-self-host")}
						>
							<ChevronRightIcon />
						</Button>
					</SettingsField>
				)}
			</SettingsGroup>
		</SettingsSection>
	)
}

function describeDeviceType(deviceType: string): string {
	if (/ios|iphone|ipad/i.test(deviceType)) return "Cortex for iOS"
	if (/android/i.test(deviceType)) return "Cortex for Android"
	if (/mac|darwin/i.test(deviceType)) return "Cortex for macOS"
	if (/win/i.test(deviceType)) return "Cortex for Windows"
	if (/linux/i.test(deviceType)) return "Cortex for Linux"
	return "Cortex desktop"
}

function DevicesSection() {
	const devices = useDevicesStore((state) => state.deviceEntries)
	const activeDevices = devices.filter((device) => !device.revoked)
	if (activeDevices.length === 0) return null
	const revoke = async (deviceId: string, deviceName: string) => {
		const confirmed = await getPlatform().dialog.showConfirm({
			title: "Revoke device",
			message: `Sign ${deviceName} out of this vault?`,
			destructive: true,
			confirmLabel: "Revoke",
		})
		if (confirmed) await useDevicesStore.getState().revokeDevice(deviceId)
	}
	return (
		<SettingsSection
			fieldId="sync.devices"
			title="Devices"
			footer="Devices appear here after signing in to this vault."
		>
			<SettingsGroup>
				{activeDevices.map((device) => {
					const Icon = /phone|ios|android|mobile/i.test(device.deviceType)
						? SmartphoneIcon
						: LaptopIcon
					const lastSeen = device.lastSeenAt ? Date.parse(device.lastSeenAt) : null
					const lastSeenLabel = lastSeen ? formatRelativeTime(lastSeen) : "Not synced yet"
					return (
						<SettingsField
							key={device.id}
							icon={<Icon />}
							label={device.deviceName}
							description={
								device.isCurrent ? `Synced ${lastSeenLabel}` : describeDeviceType(device.deviceType)
							}
						>
							{device.isCurrent ? (
								<span className="settings-pill">This device</span>
							) : (
								<>
									<span className="settings-field-value">{lastSeenLabel}</span>
									<Button
										variant="ghost"
										size="xs"
										className="settings-device-revoke"
										onClick={() => void revoke(device.id, device.deviceName)}
									>
										Revoke
									</Button>
								</>
							)}
						</SettingsField>
					)
				})}
			</SettingsGroup>
		</SettingsSection>
	)
}

function HistorySection() {
	const activeFilePath = useEditorStore((state) => state.activeFilePath)
	const rows = [
		{
			icon: ScrollTextIcon,
			fieldId: "sync.logs",
			label: "Sync logs",
			description: "Every upload, download and conflict",
			disabled: false,
			open: () => runInMainWindow("openSyncLogs"),
		},
		{
			icon: HistoryIcon,
			fieldId: "sync.version-history",
			label: "Version history",
			description: activeFilePath
				? "Restore earlier versions of the open note"
				: "Open a note to see its versions",
			disabled: !activeFilePath,
			open: () => runInMainWindow("openNoteHistory"),
		},
		{
			icon: Trash2Icon,
			fieldId: "sync.deleted-notes",
			label: "Deleted notes",
			description: "Bring back notes removed on any device",
			disabled: false,
			open: () => runInMainWindow("openDeletedNotes"),
		},
	]
	return (
		<SettingsSection title="History & recovery">
			<SettingsGroup>
				{rows.map(({ fieldId, icon: Icon, label, description, disabled, open }) => (
					<SettingsField
						key={fieldId}
						fieldId={fieldId}
						icon={<Icon />}
						label={label}
						description={description}
					>
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label={`Open ${label.toLowerCase()}`}
							disabled={disabled}
							onClick={open}
						>
							<ChevronRightIcon />
						</Button>
					</SettingsField>
				))}
			</SettingsGroup>
		</SettingsSection>
	)
}

export function SyncOverviewPage(props: SyncOverviewProps) {
	const showLink = props.syncEnabled && props.authenticated
	return (
		<SettingsPage>
			{showLink && props.linkedVaultId && <SyncStatusHero {...props} />}
			<SyncToggleSection
				authenticated={props.authenticated}
				syncEnabled={props.syncEnabled}
				vaultPath={props.vaultPath}
			/>
			{!props.authenticated && <SignedOutNotice />}
			{props.authenticated && <SubscriptionRequiredNotice />}
			{showLink && <VaultLinkSection {...props} />}
			{showLink && props.linkedVaultId && <DevicesSection />}
			{showLink && props.linkedVaultId && <HistorySection />}
		</SettingsPage>
	)
}
