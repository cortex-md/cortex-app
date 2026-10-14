import {
	canReadVaultPath,
	resolveSyncIndicatorStatus,
	type SyncIndicatorKind,
	useAuthStore,
	useEditorStore,
	useRemoteVaultStore,
	useSubscriptionStore,
	useSyncStore,
	useUIStore,
	useVaultStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@cortex/ui"
import {
	AlertTriangleIcon,
	CheckCircleIcon,
	CloudIcon,
	CloudOffIcon,
	HistoryIcon,
	LinkIcon,
	LoaderIcon,
	LockIcon,
	RefreshCwIcon,
	ScrollTextIcon,
	Trash2Icon,
	UnlinkIcon,
} from "lucide-react"
import { Suspense, useState } from "react"
import { useHasOpened } from "../../hooks/useHasOpened"
import { LazyVaultLinkModal } from "./LazyVaultLinkModal"
import { noteHistoryModal } from "./noteHistoryModal"
import { deletedNotesModal, syncLogsModal } from "./syncDialogStores"

const STATUS_BUTTON_CLASS = "statusbar-item statusbar-btn gap-1.5 tracking-normal active:scale-100"

function countActiveSyncFiles(syncingFiles: Record<string, string>): number {
	let count = 0
	for (const status of Object.values(syncingFiles)) {
		if (!status.startsWith("error:")) count++
	}
	return count
}

async function confirmUnlinkVault(vaultPath: string): Promise<void> {
	const confirmed = await getPlatform().dialog.showConfirm({
		title: "Unlink this vault?",
		message:
			"You no longer have access to the remote vault. Unlinking stops sync and keeps your local notes.",
		confirmLabel: "Unlink",
		destructive: true,
	})
	if (confirmed) await useRemoteVaultStore.getState().unlinkVault(vaultPath)
}

export function SyncIndicator() {
	const engineState = useSyncStore((s) => s.engineState)
	const activeSyncCount = useSyncStore((s) => countActiveSyncFiles(s.syncingFiles))
	const initialSyncProgress = useSyncStore((s) => s.initialSyncProgress)
	const initialSyncComplete = useSyncStore((s) => s.initialSyncComplete)
	const vekRequired = useSyncStore((s) => s.vekRequired)
	const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt)
	const error = useSyncStore((s) => s.error)
	const authenticated = useAuthStore((s) => s.authenticated)
	const vault = useVaultStore((s) => s.vault)
	const linkedVaultId = useRemoteVaultStore((s) => s.linkedVaultId)
	const syncEnabled = useRemoteVaultStore((s) => s.syncConfig.enabled)
	const subscriptionBlock = useSubscriptionStore((s) => s.block)
	const openSettings = useUIStore((s) => s.openSettings)
	const activeFilePath = useEditorStore((s) => s.activeFilePath)
	const [unlockModalOpen, setUnlockModalOpen] = useState(false)
	const unlockModalMounted = useHasOpened(unlockModalOpen)

	const isSyncActive = engineState !== "idle" && linkedVaultId

	if (vekRequired) {
		return (
			<>
				<Button
					variant="ghost"
					size="xs"
					className={`${STATUS_BUTTON_CLASS} text-status-warning hover:text-status-warning hover:underline`}
					onClick={() => setUnlockModalOpen(true)}
				>
					<LockIcon className="w-3 h-3" />
					<span>Waiting for access</span>
				</Button>
				{unlockModalMounted && (
					<Suspense fallback={null}>
						<LazyVaultLinkModal
							open={unlockModalOpen}
							onOpenChange={setUnlockModalOpen}
							unlockMode
						/>
					</Suspense>
				)}
			</>
		)
	}

	if (engineState === "idle" && syncEnabled && vault && (!authenticated || !linkedVaultId)) {
		return (
			<Button
				variant="ghost"
				size="xs"
				className={`${STATUS_BUTTON_CLASS} text-text-muted hover:text-text-primary`}
				onClick={() => openSettings("sync")}
			>
				<LinkIcon className="w-3 h-3" />
				<span>Set up sync</span>
			</Button>
		)
	}

	if (engineState === "idle") return null

	const status = resolveSyncIndicatorStatus({
		engineState,
		error,
		planBlocked: subscriptionBlock !== null,
		initialSyncProgress,
		initialSyncComplete,
		activeSyncCount,
		lastSyncedAt,
	})

	if (!status) return null

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="xs"
					className={`${STATUS_BUTTON_CLASS} hover:underline ${status.tone === "error" ? "text-destructive hover:text-destructive" : ""}`}
				>
					<SyncStatusIcon kind={status.kind} />
					<span>{status.label}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" side="top" className="min-w-[180px]">
				{status.kind === "denied" && !subscriptionBlock && vault && (
					<>
						<DropdownMenuItem
							onSelect={() => void useSyncStore.getState().restartSync()}
							className="gap-2 text-xs"
						>
							<RefreshCwIcon className="w-3.5 h-3.5" />
							Retry
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() => void confirmUnlinkVault(vault.path)}
							className="gap-2 text-xs"
							variant="destructive"
						>
							<UnlinkIcon className="w-3.5 h-3.5" />
							Unlink Vault…
						</DropdownMenuItem>
						<DropdownMenuSeparator />
					</>
				)}
				<DropdownMenuItem onSelect={() => syncLogsModal.open(true)} className="gap-2 text-xs">
					<ScrollTextIcon className="w-3.5 h-3.5" />
					Sync Logs
				</DropdownMenuItem>
				{isSyncActive && (
					<>
						<DropdownMenuSeparator />
						{activeFilePath && canReadVaultPath(activeFilePath) && (
							<DropdownMenuItem
								onSelect={() => noteHistoryModal.open({ filePath: activeFilePath })}
								className="gap-2 text-xs"
							>
								<HistoryIcon className="w-3.5 h-3.5" />
								Version History
							</DropdownMenuItem>
						)}
						<DropdownMenuItem
							onSelect={() => deletedNotesModal.open(true)}
							className="gap-2 text-xs"
						>
							<Trash2Icon className="w-3.5 h-3.5" />
							Deleted Notes
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function SyncStatusIcon({ kind }: { kind: SyncIndicatorKind }) {
	switch (kind) {
		case "denied":
		case "error":
			return <AlertTriangleIcon className="w-3 h-3" />
		case "initial-sync":
			return (
				<>
					<CloudIcon className="w-3.5 h-3.5" />
					<LoaderIcon className="w-3 h-3 animate-spin" />
				</>
			)
		case "transfers":
		case "syncing":
			return <LoaderIcon className="w-3 h-3 animate-spin" />
		case "connecting":
			return <RefreshCwIcon className="w-3 h-3 animate-spin" />
		case "synced":
			return <CheckCircleIcon className="w-3 h-3 text-status-success" />
		case "offline":
			return <CloudOffIcon className="w-3 h-3" />
	}
}
