import {
	buildDiffRows,
	buildHistoryEntries as buildEntries,
	canWriteVaultPath,
	captureCurrentNoteVersion,
	historyVersionCopyName as copyName,
	getParentPath,
	type HistoryEntry,
	type LocalVersion,
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
import { hashBytes } from "@cortex/platform/hash"
import { Button, Spinner, Tabs, TabsList, TabsTrigger } from "@cortex/ui"
import { CopyIcon, ExternalLinkIcon, InfoIcon, MonitorIcon, RotateCcwIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useCopyFeedback } from "@/hooks/useCopyFeedback"
import { formatDateTime } from "@/utils/format"
import { ModalStoreHost } from "@/utils/ModalHost"
import { noteHistoryModal } from "@/utils/modals"
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
} from "./HistoryDialogParts"
import { UserAvatar } from "./UserAvatar"
import { type SyncActorNames, useSyncActorNames } from "./useSyncActorNames"
import { useVersionContents } from "./useVersionContents"

type PaneMode = "changes" | "full"

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" })
const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" })
const THIS_DEVICE = "This device"

function entryTitle(entry: HistoryEntry, actors: SyncActorNames): string {
	if (entry.kind === "current") return "Current version"
	if (entry.kind === "local") return THIS_DEVICE
	return authorName(entry.server, actors)
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
	const parts = entry.kind === "server" ? [deviceLabel(entry.server, actors)] : []
	if (entry.timestamp !== null) parts.push(formatDateTime(entry.timestamp))
	return parts.filter(Boolean).join(" · ")
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

function VersionAvatar({ entry, actors }: { entry: HistoryEntry; actors: SyncActorNames }) {
	if (entry.kind !== "server") {
		return <MonitorIcon className="version-avatar size-3.5 shrink-0" aria-hidden="true" />
	}
	return (
		<UserAvatar
			size="sm"
			name={authorName(entry.server, actors)}
			avatarUrl={entry.server.authorAvatarUrl}
			className="version-avatar"
		/>
	)
}

function VersionRow({ entry, last, selected, delta, actors, onSelect }: VersionRowProps) {
	return (
		<Button
			size="sm"
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
					{entry.kind !== "current" && <VersionAvatar entry={entry} actors={actors} />}
					<b>{entryTitle(entry, actors)}</b>
					<span>{entryTime(entry)}</span>
				</span>
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
	selectedId: string | null
	deltas: Record<string, WordChangeCount>
	actors: SyncActorNames
	onSelect: (id: string) => void
}

function VersionRail({ entries, selectedId, deltas, actors, onSelect }: VersionRailProps) {
	const visibleEntries = entries ?? []
	const days = useMemo(
		() => groupByDay(visibleEntries, (entry) => entry.timestamp ?? Date.now()),
		[visibleEntries],
	)
	const hasVersions = entries !== null && entries.length > 1
	const lastVisibleId = visibleEntries.at(-1)?.id

	return (
		<aside className="history-rail" aria-label="Versions">
			<div className="history-list">
				{entries === null && <HistoryLoading />}
				{entries !== null && !hasVersions && (
					<HistoryEmpty
						title="No changes yet"
						description="Earlier versions of this note will appear here when its text changes."
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
					<b>{entryTitle(entry, actors)}</b>
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
				<Button variant="ghost" onClick={handleCopy} disabled={content === undefined}>
					<CopyIcon />
					{copied ? "Copied" : "Copy text"}
				</Button>
				<Button
					variant="secondary"
					onClick={() => void handleOpenAsCopy()}
					disabled={content === undefined || busy !== null}
				>
					{busy === "copy" ? <Spinner className="size-3" /> : <ExternalLinkIcon />}
					Open as copy
				</Button>
				<Button onClick={() => void handleRestore()} disabled={!canRestore || busy !== null}>
					{busy === "restore" ? <Spinner className="size-3" /> : <RotateCcwIcon />}
					Restore this version
				</Button>
			</footer>
		</>
	)
}

function NoteHistoryContent({ filePath }: { filePath: string }) {
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const actors = useSyncActorNames()
	const [localVersions, setLocalVersions] = useState<LocalVersion[] | null>(null)
	const [serverVersions, setServerVersions] = useState<VersionInfo[] | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [currentHash, setCurrentHash] = useState<string | null>(null)
	const relativePath = vaultPath ? (toVaultRelativePath(filePath, vaultPath) ?? filePath) : filePath
	const serverLinked = Boolean(vaultPath && linkedVaultId)

	useEffect(() => {
		let cancelled = false
		readCurrentNoteContent(filePath)
			.then((content) => {
				if (!cancelled) setCurrentHash(hashBytes(content))
			})
			.catch(() => undefined)
		return () => {
			cancelled = true
		}
	}, [filePath])

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
				? buildEntries(localVersions, serverVersions ?? [], currentHash)
				: null,
		[localVersions, serverVersions, serverLinked, currentHash],
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
					selectedId={activeId}
					deltas={deltas}
					actors={actors}
					onSelect={setSelectedId}
				/>
				<div className="history-pane">
					<HistoryHead title="Version history" subtitle={relativePath} />
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
