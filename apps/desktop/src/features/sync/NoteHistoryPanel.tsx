import {
	buildDiffRows,
	canWriteVaultPath,
	captureCurrentNoteVersion,
	getBaseName,
	getParentPath,
	type LocalVersion,
	type LocalVersionReason,
	listLocalVersions,
	readCurrentNoteContent,
	readLocalVersion,
	reportAppError,
	restoreLocalVersion,
	toVaultRelativePath,
	useRemoteVaultStore,
	useSyncStore,
	useVaultStore,
	useWorkspaceStore,
	type WordChangeCount,
} from "@cortex/core"
import { getPlatform, type VersionInfo } from "@cortex/platform"
import { Button, Spinner, Tabs, TabsList, TabsTrigger } from "@cortex/ui"
import { CopyIcon, ExternalLinkIcon, InfoIcon, MonitorIcon, RotateCcwIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useCopyFeedback } from "@/hooks/useCopyFeedback"
import { formatDateTime } from "@/utils/format"
import { ModalStoreHost } from "@/utils/ModalHost"
import {
	groupByDay,
	HistoryDayLabel,
	HistoryDialog,
	HistoryDiff,
	HistoryEmpty,
	HistoryError,
	HistoryHead,
	HistoryLoading,
	historyDayLabel,
	NoteReadingPreview,
	parseTimestamp,
} from "./HistoryDialogParts"
import { noteHistoryModal } from "./noteHistoryModal"
import { UserAvatar } from "./UserAvatar"
import { type SyncActorNames, useSyncActorNames } from "./useSyncActorNames"
import { useVersionContents } from "./useVersionContents"

type DeviceFilter = "all" | "device" | "others"
type PaneMode = "changes" | "full"

type HistoryEntry =
	| { kind: "current"; id: string; timestamp: null }
	| { kind: "local"; id: string; timestamp: number; local: LocalVersion }
	| { kind: "server"; id: string; timestamp: number | null; server: VersionInfo }

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" })
const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" })
const CURRENT_ENTRY: HistoryEntry = { kind: "current", id: "current", timestamp: null }
const THIS_DEVICE = "This device"

const DEVICE_FILTERS: readonly { value: DeviceFilter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "device", label: THIS_DEVICE },
	{ value: "others", label: "Others" },
]

const LOCAL_TITLES: Record<LocalVersionReason, string> = {
	edit: "Autosaved version",
	external: "Before external change",
	restore: "Before restore",
}

function entryTitle(entry: HistoryEntry): string {
	if (entry.kind === "current") return "Current version"
	if (entry.kind === "local") return LOCAL_TITLES[entry.local.reason]
	return `Version ${entry.server.version}`
}

function entryTime(entry: HistoryEntry): string {
	if (entry.timestamp === null) return ""
	return historyDayLabel(entry.timestamp) === "Earlier"
		? DATE_FORMAT.format(entry.timestamp)
		: TIME_FORMAT.format(entry.timestamp)
}

function authorName(version: VersionInfo, actors: SyncActorNames): string {
	return version.authorName ?? actors.personName(version.authorId) ?? "Unknown member"
}

function deviceLabel(version: VersionInfo, actors: SyncActorNames): string | null {
	return version.deviceName ?? actors.deviceName(version.deviceId)
}

function entryMeta(entry: HistoryEntry, actors: SyncActorNames): string {
	const parts =
		entry.kind === "server"
			? [authorName(entry.server, actors), deviceLabel(entry.server, actors)]
			: [THIS_DEVICE]
	if (entry.timestamp !== null) parts.push(formatDateTime(entry.timestamp))
	return parts.filter(Boolean).join(" · ")
}

function compareEntries(left: HistoryEntry, right: HistoryEntry): number {
	const timeOrder = (right.timestamp ?? 0) - (left.timestamp ?? 0)
	if (timeOrder !== 0) return timeOrder
	if (left.kind === "server" && right.kind === "server") {
		return right.server.version - left.server.version
	}
	return 0
}

function buildEntries(
	localVersions: readonly LocalVersion[],
	serverVersions: readonly VersionInfo[],
): HistoryEntry[] {
	const versions: HistoryEntry[] = [
		...localVersions.map(
			(local): HistoryEntry => ({
				kind: "local",
				id: `local:${local.id}`,
				timestamp: local.timestamp,
				local,
			}),
		),
		...serverVersions.map(
			(server): HistoryEntry => ({
				kind: "server",
				id: `server:${server.snapshotId}`,
				timestamp: parseTimestamp(server.createdAt),
				server,
			}),
		),
	]
	return [CURRENT_ENTRY, ...versions.sort(compareEntries)]
}

function matchesDeviceFilter(
	entry: HistoryEntry,
	filter: DeviceFilter,
	currentDeviceId: string | null,
): boolean {
	if (filter === "all") return true
	const onThisDevice = entry.kind !== "server" || entry.server.deviceId === currentDeviceId
	return filter === "device" ? onThisDevice : !onThisDevice
}

export function NoteHistoryHost() {
	return (
		<ModalStoreHost store={noteHistoryModal}>
			{(target) => <NoteHistoryContent key={target.filePath} filePath={target.filePath} />}
		</ModalStoreHost>
	)
}

interface VersionRowProps {
	entry: HistoryEntry
	last: boolean
	selected: boolean
	delta: WordChangeCount | undefined
	actors: SyncActorNames
	onSelect: () => void
}

function VersionWho({ entry, actors }: { entry: HistoryEntry; actors: SyncActorNames }) {
	if (entry.kind !== "server") {
		return (
			<span className="version-who">
				<MonitorIcon className="size-3.5 shrink-0" aria-hidden="true" />
				{THIS_DEVICE}
			</span>
		)
	}
	const author = authorName(entry.server, actors)
	const device = deviceLabel(entry.server, actors)
	return (
		<span className="version-who">
			<UserAvatar
				size="sm"
				name={author}
				avatarUrl={entry.server.authorAvatarUrl}
				className="version-avatar"
			/>
			{device ? `${author} · ${device}` : author}
		</span>
	)
}

function VersionRow({ entry, last, selected, delta, actors, onSelect }: VersionRowProps) {
	return (
		<Button
			variant="ghost"
			className="history-row version-row"
			data-selected={selected ? "true" : undefined}
			data-current={entry.kind === "current" ? "true" : undefined}
			data-last={last ? "true" : undefined}
			aria-pressed={selected}
			onClick={onSelect}
		>
			<span className="version-dot" aria-hidden="true">
				<span className="version-dot-mark" />
			</span>
			<span className="version-copy">
				<span className="version-top">
					<b>{entryTitle(entry)}</b>
					<span>{entryTime(entry)}</span>
				</span>
				<VersionWho entry={entry} actors={actors} />
				{delta && (
					<span className="version-delta">
						<span data-kind="add">+{delta.added}</span>
						<span data-kind="del">−{delta.removed}</span>
						<span>words</span>
					</span>
				)}
			</span>
		</Button>
	)
}

interface VersionRailProps {
	entries: HistoryEntry[] | null
	showDeviceFilter: boolean
	selectedId: string | null
	deltas: Record<string, WordChangeCount>
	actors: SyncActorNames
	onSelect: (id: string) => void
}

function VersionRail({
	entries,
	showDeviceFilter,
	selectedId,
	deltas,
	actors,
	onSelect,
}: VersionRailProps) {
	const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>("all")
	const visibleEntries = useMemo(
		() =>
			(entries ?? []).filter((entry) =>
				matchesDeviceFilter(entry, deviceFilter, actors.currentDeviceId),
			),
		[entries, deviceFilter, actors.currentDeviceId],
	)
	const days = useMemo(
		() => groupByDay(visibleEntries, (entry) => entry.timestamp ?? Date.now()),
		[visibleEntries],
	)
	const hasVersions = entries !== null && entries.length > 1
	const lastVisibleId = visibleEntries.at(-1)?.id

	return (
		<aside className="history-rail" aria-label="Versions">
			{showDeviceFilter && (
				<div className="history-rail-top">
					<Tabs
						value={deviceFilter}
						onValueChange={(value) => setDeviceFilter(value as DeviceFilter)}
					>
						<TabsList aria-label="Show" className="history-rail-tabs">
							{DEVICE_FILTERS.map((filter) => (
								<TabsTrigger key={filter.value} value={filter.value}>
									{filter.label}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</div>
			)}
			<div className="history-list">
				{entries === null && <HistoryLoading />}
				{entries !== null && (!hasVersions || visibleEntries.length === 0) && (
					<HistoryEmpty
						title={hasVersions ? "No versions here" : "No history yet"}
						description={
							hasVersions
								? "Try another filter."
								: "Earlier versions of this note will appear here as it changes."
						}
					/>
				)}
				{hasVersions &&
					days.map((day) => (
						<section key={day.label} aria-label={day.label}>
							<HistoryDayLabel>{day.label}</HistoryDayLabel>
							{day.items.map((entry) => (
								<VersionRow
									key={entry.id}
									entry={entry}
									last={entry.id === lastVisibleId}
									selected={entry.id === selectedId}
									delta={deltas[entry.id]}
									actors={actors}
									onSelect={() => onSelect(entry.id)}
								/>
							))}
						</section>
					))}
			</div>
		</aside>
	)
}

interface VersionPaneProps {
	filePath: string
	relativePath: string
	entry: HistoryEntry
	content: string | undefined
	previousContent: string | undefined
	actors: SyncActorNames
	onError: (message: string) => void
}

function copyName(filePath: string, entry: HistoryEntry): string {
	const baseName = getBaseName(filePath).replace(/\.md$/i, "")
	return entry.kind === "server"
		? `${baseName} (version ${entry.server.version})`
		: `${baseName} (earlier version)`
}

function VersionPane({
	filePath,
	relativePath,
	entry,
	content,
	previousContent,
	actors,
	onError,
}: VersionPaneProps) {
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const [mode, setMode] = useState<PaneMode>("changes")
	const [busy, setBusy] = useState<"restore" | "copy" | null>(null)
	const [copied, showCopied] = useCopyFeedback()
	const diffRows = useMemo(
		() =>
			content !== undefined && previousContent !== undefined
				? buildDiffRows(previousContent, content)
				: null,
		[content, previousContent],
	)
	const canRestore = entry.kind !== "current" && canWriteVaultPath(filePath)

	const handleCopy = () => {
		if (content === undefined) return
		void getPlatform().clipboard.writeText(content)
		showCopied()
	}

	const handleOpenAsCopy = async () => {
		if (content === undefined) return
		setBusy("copy")
		try {
			const copyPath = await useVaultStore
				.getState()
				.createFileWithContent(getParentPath(filePath), copyName(filePath, entry), content)
			useWorkspaceStore.getState().openTab(copyPath)
			noteHistoryModal.close()
		} catch (reason) {
			void reportAppError({
				operation: "open-version-copy",
				source: "sync",
				cause: reason,
				userMessage: "Cortex could not create a copy of this version.",
			})
		} finally {
			setBusy(null)
		}
	}

	const handleRestore = async () => {
		setBusy("restore")
		try {
			if (entry.kind === "local") {
				await restoreLocalVersion(filePath, entry.local.id)
			} else if (entry.kind === "server" && vaultPath && linkedVaultId) {
				await captureCurrentNoteVersion(filePath, "restore")
				await useSyncStore
					.getState()
					.restoreVersion(linkedVaultId, vaultPath, relativePath, String(entry.server.version))
			} else {
				return
			}
			noteHistoryModal.close()
		} catch (reason) {
			onError(String(reason))
		} finally {
			setBusy(null)
		}
	}

	return (
		<>
			<div className="history-pane-head">
				<div className="history-pane-title">
					<b>{entryTitle(entry)}</b>
					<span>{entryMeta(entry, actors)}</span>
				</div>
				<Tabs value={mode} onValueChange={(value) => setMode(value as PaneMode)}>
					<TabsList aria-label="View" className="history-mode-tabs">
						<TabsTrigger value="changes">Changes</TabsTrigger>
						<TabsTrigger value="full">Full note</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>
			<div className="history-pane-body">
				{content === undefined ? (
					<HistoryLoading />
				) : mode === "full" ? (
					<NoteReadingPreview content={content} />
				) : (
					<>
						<p className="history-pane-hint">
							Compared with the version before it. Unchanged lines are folded.
						</p>
						{diffRows ? <HistoryDiff rows={diffRows} /> : <HistoryLoading />}
					</>
				)}
			</div>
			<footer className="history-foot">
				<span className="history-foot-note">
					<InfoIcon className="size-3.5" aria-hidden="true" />
					Restoring keeps the current text as a new version, so nothing is lost.
				</span>
				<Button variant="ghost" size="sm" onClick={handleCopy} disabled={content === undefined}>
					<CopyIcon />
					{copied ? "Copied" : "Copy text"}
				</Button>
				<Button
					variant="secondary"
					size="sm"
					onClick={() => void handleOpenAsCopy()}
					disabled={content === undefined || busy !== null}
				>
					{busy === "copy" ? <Spinner className="size-3" /> : <ExternalLinkIcon />}
					Open as copy
				</Button>
				<Button
					size="sm"
					onClick={() => void handleRestore()}
					disabled={!canRestore || busy !== null}
				>
					{busy === "restore" ? <Spinner className="size-3" /> : <RotateCcwIcon />}
					Restore this version
				</Button>
			</footer>
		</>
	)
}

function historySubtitle(relativePath: string, entries: HistoryEntry[] | null): string {
	if (!entries) return relativePath
	let local = 0
	let server = 0
	for (const entry of entries) {
		if (entry.kind === "local") local++
		else if (entry.kind === "server") server++
	}
	const counts = [
		server > 0 ? `${server} kept by Cortex Sync` : null,
		`${local} on this device`,
	].filter(Boolean)
	return `${relativePath} · ${counts.join(" · ")}`
}

function NoteHistoryContent({ filePath }: { filePath: string }) {
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const actors = useSyncActorNames()
	const [localVersions, setLocalVersions] = useState<LocalVersion[] | null>(null)
	const [serverVersions, setServerVersions] = useState<VersionInfo[] | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const relativePath = vaultPath ? (toVaultRelativePath(filePath, vaultPath) ?? filePath) : filePath
	const serverLinked = Boolean(vaultPath && linkedVaultId)

	useEffect(() => {
		let cancelled = false
		listLocalVersions(filePath)
			.then((versions) => {
				if (!cancelled) setLocalVersions(versions)
			})
			.catch((reason: unknown) => {
				if (cancelled) return
				setLocalVersions([])
				setError(String(reason))
			})
		return () => {
			cancelled = true
		}
	}, [filePath])

	useEffect(() => {
		if (!vaultPath || !linkedVaultId) return
		let cancelled = false
		useSyncStore
			.getState()
			.getVersionHistory(linkedVaultId, vaultPath, relativePath)
			.then((history) => {
				if (!cancelled) setServerVersions(history)
			})
			.catch((reason: unknown) => {
				if (cancelled) return
				setServerVersions([])
				setError(`Cortex Sync history is unavailable: ${String(reason)}`)
			})
		return () => {
			cancelled = true
		}
	}, [vaultPath, linkedVaultId, relativePath])

	const entries = useMemo(
		() =>
			localVersions && (!serverLinked || serverVersions)
				? buildEntries(localVersions, serverVersions ?? [])
				: null,
		[localVersions, serverVersions, serverLinked],
	)

	const loadEntryContent = useCallback(
		(entry: HistoryEntry): Promise<string> => {
			if (entry.kind === "current") return readCurrentNoteContent(filePath)
			if (entry.kind === "local") return readLocalVersion(filePath, entry.local.id)
			if (!vaultPath || !linkedVaultId) return Promise.reject(new Error("Vault is not linked"))
			return useSyncStore
				.getState()
				.downloadVersion(linkedVaultId, vaultPath, relativePath, String(entry.server.version))
		},
		[filePath, vaultPath, linkedVaultId, relativePath],
	)
	const { contents, deltas, loadContent } = useVersionContents(entries, loadEntryContent)

	const activeId = selectedId ?? (entries && entries.length > 1 ? entries[1].id : null)
	const selectedIndex = entries?.findIndex((entry) => entry.id === activeId) ?? -1
	const selected = selectedIndex >= 0 ? entries?.[selectedIndex] : undefined
	const previous = selectedIndex >= 0 ? entries?.[selectedIndex + 1] : undefined

	useEffect(() => {
		if (!selected) return
		loadContent(selected.id).catch((reason: unknown) => setError(String(reason)))
		if (previous) loadContent(previous.id).catch(() => undefined)
	}, [selected, previous, loadContent])

	return (
		<HistoryDialog title="Version history" description={`Earlier versions of ${relativePath}`}>
			<div className="history-body">
				<VersionRail
					entries={entries}
					showDeviceFilter={serverLinked}
					selectedId={activeId}
					deltas={deltas}
					actors={actors}
					onSelect={setSelectedId}
				/>
				<div className="history-pane">
					<HistoryHead title="Version history" subtitle={historySubtitle(relativePath, entries)} />
					{error && <HistoryError message={error} />}
					{selected && (
						<VersionPane
							key={selected.id}
							filePath={filePath}
							relativePath={relativePath}
							entry={selected}
							content={contents[selected.id]}
							previousContent={previous ? contents[previous.id] : ""}
							actors={actors}
							onError={setError}
						/>
					)}
				</div>
			</div>
		</HistoryDialog>
	)
}
