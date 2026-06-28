import { formatLastSyncedAt, SYNC_STATUS_PRESENTATION, useRemoteVaultStore } from "@cortex/core"
import type { SyncEngineState } from "@cortex/platform"
import { Button, Switch } from "@cortex/ui"
import { Cloud, CloudOff, Link } from "lucide-react"
import {
	SettingsField,
	SettingsGroup,
	SettingsGroupContent,
	SettingsPage,
	SettingsSection,
} from "../SettingsPrimitives"
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
	devicesLoading: boolean
	engineState: SyncEngineState
	lastSyncedAt: number | null
	linkedVaultId: string | null
	noteCount: number
	remoteVaultRole?: string
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
	return (
		<SettingsSection
			title="Sync"
			description="Enable or disable sync for this vault without changing its remote link."
		>
			<SettingsGroup>
				<SettingsField label="Enable sync for this vault" htmlFor="sync-enabled">
					<Switch
						id="sync-enabled"
						checked={syncEnabled}
						disabled={!authenticated}
						onCheckedChange={(checked) => {
							if (vaultPath) void setSyncEnabled(vaultPath, checked).catch(() => {})
						}}
					/>
				</SettingsField>
			</SettingsGroup>
		</SettingsSection>
	)
}

export function VaultLinkSection({
	linkedVaultId,
	vaultName,
	remoteVaultRole,
	engineState,
	lastSyncedAt,
	connectedDeviceCount,
	devicesLoading,
	noteCount,
	onOpenLink,
}: Omit<SyncOverviewProps, "authenticated" | "syncEnabled" | "vaultPath">) {
	const status = SYNC_STATUS_PRESENTATION[engineState]
	return (
		<SettingsSection
			title="Remote vault"
			description="The remote vault linked to this local vault."
		>
			<SettingsGroup>
				{linkedVaultId ? (
					<>
						<div className="flex items-center gap-3 px-4 py-4">
							<div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-muted text-muted-foreground">
								<Cloud className="size-4" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="m-0 truncate text-[13px] font-semibold text-foreground">
									{vaultName}
								</p>
								<div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
									<span className={`size-1.5 rounded-full ${statusToneClassNames[status.tone]}`} />
									<span>{status.label}</span>
									{remoteVaultRole && (
										<>
											<span aria-hidden="true">·</span>
											<span className="capitalize">{remoteVaultRole} access</span>
										</>
									)}
								</div>
							</div>
							<Button variant="ghost" size="xs" onClick={onOpenLink}>
								Change
							</Button>
						</div>
						<SettingsField label="Last synced">
							<span className="text-[13px] text-muted-foreground">
								{formatLastSyncedAt(lastSyncedAt)}
							</span>
						</SettingsField>
						<SettingsField label="Connected devices">
							<span className="text-[13px] text-muted-foreground">
								{devicesLoading
									? "Loading"
									: `${connectedDeviceCount} ${connectedDeviceCount === 1 ? "device" : "devices"}`}
							</span>
						</SettingsField>
						<SettingsField label="Synced notes">
							<span className="text-[13px] text-muted-foreground">
								{noteCount} {noteCount === 1 ? "note" : "notes"}
							</span>
						</SettingsField>
					</>
				) : (
					<SettingsGroupContent className="p-0">
						<div className="flex items-center gap-3 px-4 py-4">
							<div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-muted text-muted-foreground">
								<CloudOff className="size-4" />
							</div>
							<span className="flex-1 text-muted-foreground">
								Link or create a remote vault to start syncing.
							</span>
							<Button variant="default" size="sm" onClick={onOpenLink}>
								<Link />
								Link vault
							</Button>
						</div>
					</SettingsGroupContent>
				)}
			</SettingsGroup>
		</SettingsSection>
	)
}

export function SyncOverviewPage(props: SyncOverviewProps) {
	return (
		<SettingsPage>
			<SyncToggleSection
				authenticated={props.authenticated}
				syncEnabled={props.syncEnabled}
				vaultPath={props.vaultPath}
			/>
			{!props.authenticated && <SignedOutNotice />}
			{props.authenticated && <SubscriptionRequiredNotice />}
			{props.syncEnabled && props.authenticated && <VaultLinkSection {...props} />}
		</SettingsPage>
	)
}
