import {
	buildDiffRows,
	getBaseName,
	getParentPath,
	reportAppError,
	toVaultRelativePath,
	useRemoteVaultStore,
	useSyncStore,
	useVaultStore,
	useWorkspaceStore,
	type WordChangeCount,
} from "@cortex/core"
import { getPlatform, type VersionInfo } from "@cortex/platform"
import { Button, Spinner, Tabs, TabsList, TabsTrigger } from "@cortex/ui"
import { CopyIcon, ExternalLinkIcon, InfoIcon, RotateCcwIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
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

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" })
const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" })

const DEVICE_FILTERS: readonly { value: DeviceFilter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "device", label: "This device" },
	{ value: "others", label: "Others" },
]

function versionTitle(version: VersionInfo, latest: boolean): string {
	return latest ? "Current version" : `Version ${version.version}`
}

function versionTime(version: VersionInfo): string {
	const timestamp = parseTimestamp(version.createdAt)
	if (timestamp === null) return ""
	return historyDayLabel(timestamp) === "Earlier"
		? DATE_FORMAT.format(timestamp)
		: TIME_FORMAT.format(timestamp)
}

function authorName(version: VersionInfo, actors: SyncActorNames): string {
	return version.authorName ?? actors.personName(version.authorId) ?? "Unknown member"
}

function deviceLabel(version: VersionInfo, actors: SyncActorNames): string | null {
	return version.deviceName ?? actors.deviceName(version.deviceId)
}

export function NoteHistoryHost() {
	return (
		<ModalStoreHost store={noteHistoryModal}>
			{(target) => <NoteHistoryContent key={target.filePath} filePath={target.filePath} />}
		</ModalStoreHost>
	)
}

interface VersionRowProps {
	version: VersionInfo
	latest: boolean
	last: boolean
	selected: boolean
	delta: WordChangeCount | undefined
	actors: SyncActorNames
	onSelect: () => void
}

function VersionRow({ version, latest, last, selected, delta, actors, onSelect }: VersionRowProps) {
	const author = authorName(version, actors)
	const device = deviceLabel(version, actors)
	return (
		<Button
			variant="ghost"
			className="history-row version-row"
			data-selected={selected ? "true" : undefined}
			data-current={latest ? "true" : undefined}
			data-last={last ? "true" : undefined}
			aria-pressed={selected}
			onClick={onSelect}
		>
			<span className="version-dot" aria-hidden="true">
				<span className="version-dot-mark" />
			</span>
			<span className="version-copy">
				<span className="version-top">
					<b>{versionTitle(version, latest)}</b>
					<span>{versionTime(version)}</span>
				</span>
				<span className="version-who">
					<UserAvatar
						size="sm"
						name={author}
						avatarUrl={version.authorAvatarUrl}
						className="version-avatar"
					/>
					{device ? `${author} · ${device}` : author}
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
	versions: VersionInfo[] | null
	selectedId: string | null
	deltas: Record<number, WordChangeCount>
	actors: SyncActorNames
	loading: boolean
	onSelect: (snapshotId: string) => void
}

function VersionRail({
	versions,
	selectedId,
	deltas,
	actors,
	loading,
	onSelect,
}: VersionRailProps) {
	const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>("all")
	const visibleVersions = useMemo(() => {
		if (!versions) return []
		if (deviceFilter === "all") return versions
		return versions.filter((version) =>
			deviceFilter === "device"
				? version.deviceId === actors.currentDeviceId
				: version.deviceId !== actors.currentDeviceId,
		)
	}, [versions, deviceFilter, actors.currentDeviceId])
	const days = useMemo(
		() => groupByDay(visibleVersions, (version) => parseTimestamp(version.createdAt)),
		[visibleVersions],
	)
	const latestId = versions?.[0]?.snapshotId
	const lastVisibleId = visibleVersions.at(-1)?.snapshotId

	return (
		<aside className="history-rail" aria-label="Versions">
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
			<div className="history-list">
				{loading && <HistoryLoading />}
				{versions !== null && visibleVersions.length === 0 && (
					<HistoryEmpty
						title={versions.length === 0 ? "No history yet" : "No versions here"}
						description={
							versions.length === 0
								? "Synced versions of this note will appear here."
								: "Try another filter."
						}
					/>
				)}
				{days.map((day) => (
					<section key={day.label} aria-label={day.label}>
						<HistoryDayLabel>{day.label}</HistoryDayLabel>
						{day.items.map((version) => (
							<VersionRow
								key={version.snapshotId}
								version={version}
								latest={version.snapshotId === latestId}
								last={version.snapshotId === lastVisibleId}
								selected={version.snapshotId === selectedId}
								delta={deltas[version.version]}
								actors={actors}
								onSelect={() => onSelect(version.snapshotId)}
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
	version: VersionInfo
	latest: boolean
	content: string | undefined
	previousContent: string | undefined
	actors: SyncActorNames
	onError: (message: string) => void
}

function VersionPane({
	filePath,
	relativePath,
	version,
	latest,
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
	const timestamp = parseTimestamp(version.createdAt)
	const meta = [
		authorName(version, actors),
		deviceLabel(version, actors),
		timestamp !== null ? formatDateTime(timestamp) : null,
	]
		.filter(Boolean)
		.join(" · ")

	const handleCopy = () => {
		if (content === undefined) return
		void getPlatform().clipboard.writeText(content)
		showCopied()
	}

	const handleOpenAsCopy = async () => {
		if (content === undefined) return
		setBusy("copy")
		try {
			const name = `${getBaseName(filePath).replace(/\.md$/i, "")} (version ${version.version})`
			const copyPath = await useVaultStore
				.getState()
				.createFileWithContent(getParentPath(filePath), name, content)
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
		if (!vaultPath || !linkedVaultId) return
		setBusy("restore")
		try {
			await useSyncStore
				.getState()
				.restoreVersion(linkedVaultId, vaultPath, relativePath, String(version.version))
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
					<b>{versionTitle(version, latest)}</b>
					<span>{meta}</span>
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
				<Button size="sm" onClick={() => void handleRestore()} disabled={latest || busy !== null}>
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
	const [versions, setVersions] = useState<VersionInfo[] | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const relativePath = vaultPath ? (toVaultRelativePath(filePath, vaultPath) ?? filePath) : filePath
	const { contents, deltas, loadContent } = useVersionContents(versions, relativePath)

	useEffect(() => {
		if (!vaultPath || !linkedVaultId) {
			setError("This vault is not linked to Cortex Sync.")
			return
		}
		let cancelled = false
		useSyncStore
			.getState()
			.getVersionHistory(linkedVaultId, vaultPath, relativePath)
			.then((history) => {
				if (cancelled) return
				const sorted = history.toSorted((left, right) => right.version - left.version)
				setVersions(sorted)
				setSelectedId((sorted[1] ?? sorted[0])?.snapshotId ?? null)
			})
			.catch((reason: unknown) => {
				if (!cancelled) setError(String(reason))
			})
		return () => {
			cancelled = true
		}
	}, [vaultPath, linkedVaultId, relativePath])

	const selectedIndex = versions?.findIndex((version) => version.snapshotId === selectedId) ?? -1
	const selected = selectedIndex >= 0 ? versions?.[selectedIndex] : undefined
	const previous = selectedIndex >= 0 ? versions?.[selectedIndex + 1] : undefined

	useEffect(() => {
		if (!selected) return
		loadContent(selected.version).catch((reason: unknown) => setError(String(reason)))
		if (previous) loadContent(previous.version).catch(() => undefined)
	}, [selected, previous, loadContent])

	const versionCount = versions
		? ` · ${versions.length} ${versions.length === 1 ? "version" : "versions"} kept by Cortex Sync`
		: ""

	return (
		<HistoryDialog title="Version history" description={`Earlier versions of ${relativePath}`}>
			<div className="history-body">
				<VersionRail
					versions={versions}
					selectedId={selectedId}
					deltas={deltas}
					actors={actors}
					loading={versions === null && !error}
					onSelect={setSelectedId}
				/>
				<div className="history-pane">
					<HistoryHead title="Version history" subtitle={`${relativePath}${versionCount}`} />
					{error && <HistoryError message={error} />}
					{selected && (
						<VersionPane
							key={selected.snapshotId}
							filePath={filePath}
							relativePath={relativePath}
							version={selected}
							latest={selectedIndex === 0}
							content={contents[selected.version]}
							previousContent={previous ? contents[previous.version] : ""}
							actors={actors}
							onError={setError}
						/>
					)}
				</div>
			</div>
		</HistoryDialog>
	)
}
