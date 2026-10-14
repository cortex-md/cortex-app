import {
	buildSyncLogItems,
	formatSyncLogPaths,
	groupSyncLogItems,
	type SyncLogEntry,
	type SyncLogItem,
	type SyncLogKind,
	type SyncLogLevel,
	useSyncLogStore,
	useSyncStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { joinPath } from "@cortex/platform/utils"
import {
	Button,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	Tabs,
	TabsList,
	TabsTrigger,
} from "@cortex/ui"
import {
	ArrowDownIcon,
	ArrowUpIcon,
	CircleAlertIcon,
	CopyIcon,
	GitMergeIcon,
	InfoIcon,
	LinkIcon,
	type LucideIcon,
	RotateCwIcon,
	SearchIcon,
	Trash2Icon,
	TriangleAlertIcon,
} from "lucide-react"
import { useDeferredValue, useMemo, useState } from "react"
import { useCopyFeedback } from "@/hooks/useCopyFeedback"
import { useMinuteNow } from "@/hooks/useMinuteNow"
import { ModalHost } from "@/utils/ModalHost"
import { HistoryDialog, HistoryEmpty, HistoryHead } from "./HistoryDialogParts"
import { syncConflictModal, syncLogsModal } from "./syncDialogStores"

type LevelFilter = SyncLogLevel | "all"

const LEVEL_FILTERS: readonly { label: string; value: LevelFilter }[] = [
	{ label: "All", value: "all" },
	{ label: "Info", value: "info" },
	{ label: "Warn", value: "warn" },
	{ label: "Error", value: "error" },
]

const KIND_ICONS: Record<SyncLogKind, LucideIcon> = {
	upload: ArrowUpIcon,
	download: ArrowDownIcon,
	merge: GitMergeIcon,
	delete: Trash2Icon,
	conflict: TriangleAlertIcon,
	retry: RotateCwIcon,
	connection: LinkIcon,
	event: InfoIcon,
}

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hour12: false,
})

function formatEntryAsText(entry: SyncLogEntry): string {
	const meta = entry.metadata
		? ` ${Object.entries(entry.metadata)
				.map(([key, value]) => `${key}=${value}`)
				.join(" ")}`
		: ""
	return `[${TIME_FORMAT.format(entry.timestamp)}] [${entry.level.toUpperCase()}] ${entry.message}${meta}`
}

function matchesQuery(item: SyncLogItem, query: string): boolean {
	if (!query) return true
	const haystack = [
		item.title,
		item.detail ?? "",
		...item.paths,
		...item.entries.map((e) => e.message),
	]
		.join("\n")
		.toLowerCase()
	return haystack.includes(query)
}

interface Props {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function SyncLogsModal({ open, onOpenChange }: Props) {
	return (
		<ModalHost open={open} onOpenChange={onOpenChange}>
			<SyncLogsContent />
		</ModalHost>
	)
}

function openLoggedNote(relativePath: string): void {
	const vaultPath = useVaultStore.getState().vault?.path
	if (!vaultPath) return
	useWorkspaceStore.getState().openTab(joinPath(vaultPath, relativePath))
	syncLogsModal.close()
}

function SyncLogRow({ item }: { item: SyncLogItem }) {
	const conflictPath = item.kind === "conflict" ? item.paths[0] : undefined
	const conflictPending = useSyncStore((state) =>
		conflictPath ? Boolean(state.conflicts[conflictPath]) : false,
	)
	const Icon =
		item.kind === "event" && item.tone === "error" ? CircleAlertIcon : KIND_ICONS[item.kind]
	const paths = formatSyncLogPaths(item.paths)

	return (
		<div className="sync-log-row">
			<span className="sync-log-icon" data-tone={item.tone}>
				<Icon className="size-3.5" aria-hidden="true" />
			</span>
			<div className="sync-log-message">
				<b>{item.title}</b>
				{paths && <code title={item.paths.join("\n")}>{paths}</code>}
				{item.detail && (
					<div className="sync-log-detail" data-tone={item.tone}>
						{item.detail}
					</div>
				)}
				{conflictPath && (
					<div className="sync-log-actions">
						{conflictPending && (
							<Button
								size="xs"
								onClick={() => syncConflictModal.open({ relativePath: conflictPath })}
							>
								Resolve conflict
							</Button>
						)}
						<Button variant="ghost" size="xs" onClick={() => openLoggedNote(conflictPath)}>
							Open note
						</Button>
					</div>
				)}
			</div>
			<time className="sync-log-time" dateTime={new Date(item.timestamp).toISOString()}>
				{TIME_FORMAT.format(item.timestamp)}
			</time>
		</div>
	)
}

function SyncLogsContent() {
	const entries = useSyncLogStore((state) => state.entries)
	const clear = useSyncLogStore((state) => state.clear)
	const now = useMinuteNow()
	const [level, setLevel] = useState<LevelFilter>("all")
	const [query, setQuery] = useState("")
	const deferredQuery = useDeferredValue(query.trim().toLowerCase())
	const [copied, showCopied] = useCopyFeedback()

	const items = useMemo(() => buildSyncLogItems(entries), [entries])
	const groups = useMemo(() => {
		const visible = items.filter(
			(item) => (level === "all" || item.level === level) && matchesQuery(item, deferredQuery),
		)
		return groupSyncLogItems(visible, now)
	}, [items, level, deferredQuery, now])

	const handleCopy = () => {
		void getPlatform().clipboard.writeText(entries.map(formatEntryAsText).join("\n"))
		showCopied()
	}

	return (
		<HistoryDialog
			title="Sync logs"
			description="Uploads, downloads, conflicts and connection changes for this vault."
			variant="feed"
		>
			<HistoryHead
				title="Sync logs"
				actions={
					<>
						<Button variant="ghost" onClick={handleCopy} disabled={entries.length === 0}>
							<CopyIcon />
							{copied ? "Copied" : "Copy"}
						</Button>
						<Button variant="ghost" onClick={clear} disabled={entries.length === 0}>
							Clear
						</Button>
					</>
				}
			/>
			<div className="sync-log-bar">
				<Tabs value={level} onValueChange={(value) => setLevel(value as LevelFilter)}>
					<TabsList aria-label="Level" className="sync-log-levels">
						{LEVEL_FILTERS.map((filter) => (
							<TabsTrigger key={filter.value} value={filter.value}>
								{filter.label}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				<InputGroup variant="search" className="sync-log-search">
					<InputGroupAddon>
						<SearchIcon />
					</InputGroupAddon>
					<InputGroupInput
						aria-label="Filter sync logs"
						placeholder="Filter sync logs"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</InputGroup>
			</div>
			<div className="sync-log-feed" role="log" aria-label="Sync activity">
				{groups.length === 0 ? (
					<HistoryEmpty
						title={entries.length === 0 ? "No sync activity yet" : "No matching log entries"}
						description={
							entries.length === 0
								? "Uploads, downloads and conflicts appear here as they happen."
								: "Choose another level or filter."
						}
					/>
				) : (
					groups.map((group) => (
						<section key={group.label} aria-label={group.label}>
							<div className="history-day">{group.label}</div>
							{group.items.map((item) => (
								<SyncLogRow key={item.id} item={item} />
							))}
						</section>
					))
				)}
			</div>
		</HistoryDialog>
	)
}
