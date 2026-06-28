import {
	useAuthStore,
	useEditorStore,
	useRemoteVaultStore,
	useSubscriptionStore,
	useSyncStore,
	useUIStore,
	useVaultStore,
} from "@cortex/core"
import {
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
} from "lucide-react"
import { useState } from "react"
import { DeletedNotesPanel } from "./DeletedNotesPanel"
import { NoteHistoryPanel } from "./NoteHistoryPanel"
import { SyncLogsModal } from "./SyncLogsModal"
import { VaultLinkModal } from "./VaultLinkModal"

export function SyncIndicator() {
	const engineState = useSyncStore((s) => s.engineState)
	const syncingFiles = useSyncStore((s) => s.syncingFiles)
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
	const activeSyncCount = Object.values(syncingFiles).filter((s) => !s.startsWith("error:")).length
	const [unlockModalOpen, setUnlockModalOpen] = useState(false)
	const [logsOpen, setLogsOpen] = useState(false)
	const [deletedNotesOpen, setDeletedNotesOpen] = useState(false)
	const [historyFilePath, setHistoryFilePath] = useState<string | null>(null)

	const isSyncActive = engineState !== "idle" && linkedVaultId

	if (vekRequired) {
		return (
			<>
				<button
					type="button"
					className="statusbar-item flex items-center gap-1.5 text-status-warning hover:opacity-80"
					onClick={() => setUnlockModalOpen(true)}
				>
					<LockIcon className="w-3 h-3" />
					<span>Unlock Required</span>
				</button>
				<VaultLinkModal open={unlockModalOpen} onOpenChange={setUnlockModalOpen} unlockMode />
			</>
		)
	}

	if (engineState === "idle" && syncEnabled && vault && (!authenticated || !linkedVaultId)) {
		return (
			<button
				type="button"
				className="statusbar-item flex items-center gap-1.5 text-text-muted hover:text-text-primary"
				onClick={() => openSettings("sync")}
			>
				<LinkIcon className="w-3 h-3" />
				<span>Set up sync</span>
			</button>
		)
	}

	if (engineState === "idle") return null

	const statusContent = buildStatusContent({
		engineState,
		error,
		planBlocked: subscriptionBlock !== null,
		initialSyncProgress,
		initialSyncComplete,
		activeSyncCount,
		lastSyncedAt,
	})

	if (!statusContent) return null

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className={`statusbar-item flex items-center gap-1.5 hover:opacity-80 ${statusContent.className ?? ""}`}
					>
						{statusContent.content}
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" side="top" className="min-w-[180px]">
					<DropdownMenuItem onSelect={() => setLogsOpen(true)} className="gap-2 text-xs">
						<ScrollTextIcon className="w-3.5 h-3.5" />
						Sync Logs
					</DropdownMenuItem>
					{isSyncActive && (
						<>
							<DropdownMenuSeparator />
							{activeFilePath && (
								<DropdownMenuItem
									onSelect={() => setHistoryFilePath(activeFilePath)}
									className="gap-2 text-xs"
								>
									<HistoryIcon className="w-3.5 h-3.5" />
									Version History
								</DropdownMenuItem>
							)}
							<DropdownMenuItem
								onSelect={() => setDeletedNotesOpen(true)}
								className="gap-2 text-xs"
							>
								<Trash2Icon className="w-3.5 h-3.5" />
								Deleted Notes
							</DropdownMenuItem>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			<SyncLogsModal open={logsOpen} onOpenChange={setLogsOpen} />
			<DeletedNotesPanel open={deletedNotesOpen} onOpenChange={setDeletedNotesOpen} />
			<NoteHistoryPanel
				filePath={historyFilePath ?? ""}
				open={historyFilePath !== null}
				onOpenChange={(open) => {
					if (!open) setHistoryFilePath(null)
				}}
			/>
		</>
	)
}

interface StatusContentResult {
	content: React.ReactNode
	className?: string
}

function buildStatusContent(params: {
	engineState: string
	error: string | null
	planBlocked: boolean
	initialSyncProgress: { total: number; completed: number } | null
	initialSyncComplete: boolean
	activeSyncCount: number
	lastSyncedAt: number | null
}): StatusContentResult | null {
	const {
		engineState,
		error,
		planBlocked,
		initialSyncProgress,
		initialSyncComplete,
		activeSyncCount,
		lastSyncedAt,
	} = params

	if (engineState === "denied") {
		return {
			className: "text-destructive",
			content: (
				<>
					<AlertTriangleIcon className="w-3 h-3" />
					<span>{planBlocked ? "Plan Required" : "Access Denied"}</span>
				</>
			),
		}
	}

	if (error && engineState !== "live" && engineState !== "idle") {
		return {
			className: "text-destructive",
			content: (
				<>
					<AlertTriangleIcon className="w-3 h-3" />
					<span>Sync Error</span>
				</>
			),
		}
	}

	if (initialSyncProgress && !initialSyncComplete) {
		const { total, completed } = initialSyncProgress
		const label = total > 0 ? `Syncing ${completed}/${total} files...` : "Syncing..."
		return {
			content: (
				<>
					<CloudIcon className="w-3.5 h-3.5" />
					<LoaderIcon className="w-3 h-3 animate-spin" />
					<span>{label}</span>
				</>
			),
		}
	}

	if (activeSyncCount > 0) {
		return {
			content: (
				<>
					<LoaderIcon className="w-3 h-3 animate-spin" />
					<span>Syncing {activeSyncCount} file(s)...</span>
				</>
			),
		}
	}

	const isPollingActive = engineState === "offline" && lastSyncedAt !== null

	const stateConfig = {
		connecting: { icon: RefreshCwIcon, label: "Connecting...", iconClass: "animate-spin" },
		authenticating: { icon: RefreshCwIcon, label: "Authenticating...", iconClass: "animate-spin" },
		syncing: { icon: LoaderIcon, label: "Syncing...", iconClass: "animate-spin" },
		live: { icon: CheckCircleIcon, label: "Synced", iconClass: "" },
		offline: {
			icon: isPollingActive ? CheckCircleIcon : CloudOffIcon,
			label: isPollingActive ? "Synced" : "Offline",
			iconClass: "",
		},
		recovering: { icon: RefreshCwIcon, label: "Recovering...", iconClass: "animate-spin" },
	} as const

	const config = stateConfig[engineState as keyof typeof stateConfig]
	if (!config) return null

	const Icon = config.icon
	return {
		content: (
			<>
				<Icon className={`w-3 h-3 ${config.iconClass}`} />
				<span>{config.label}</span>
			</>
		),
	}
}
