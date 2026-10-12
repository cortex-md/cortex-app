import {
	formatRelativeTime,
	getBaseName,
	getParentPath,
	reportAppError,
	useRemoteVaultStore,
	useSyncStore,
	useVaultStore,
} from "@cortex/core"
import { type DeletedFileInfo, getPlatform } from "@cortex/platform"
import { Badge, Button, InputGroup, InputGroupAddon, InputGroupInput, Spinner } from "@cortex/ui"
import { CopyIcon, FolderIcon, RotateCcwIcon, SearchIcon } from "lucide-react"
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { useCopyFeedback } from "@/hooks/useCopyFeedback"
import { formatDateTime } from "@/utils/format"
import { ModalHost } from "@/utils/ModalHost"
import {
	groupByDay,
	HistoryDayLabel,
	HistoryDialog,
	HistoryEmpty,
	HistoryError,
	HistoryHead,
	HistoryLoading,
	NoteReadingPreview,
	parseTimestamp,
} from "./HistoryDialogParts"
import { useSyncActorNames } from "./useSyncActorNames"

interface DeletedNotesPanelProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

type PreviewState =
	| { status: "loading" }
	| { status: "ready"; content: string }
	| { status: "error"; message: string }

function noteTitle(filePath: string): string {
	return getBaseName(filePath).replace(/\.md$/i, "")
}

function noteFolder(filePath: string): string {
	return getParentPath(filePath) || "Vault root"
}

export function DeletedNotesPanel({ open, onOpenChange }: DeletedNotesPanelProps) {
	return (
		<ModalHost open={open} onOpenChange={onOpenChange}>
			<DeletedNotesContent />
		</ModalHost>
	)
}

function DeletedNoteRow({
	file,
	selected,
	onSelect,
}: {
	file: DeletedFileInfo
	selected: boolean
	onSelect: () => void
}) {
	const deletedAt = parseTimestamp(file.deletedAt)
	return (
		<Button
			variant="ghost"
			className="history-row deleted-note-row"
			data-selected={selected ? "true" : undefined}
			aria-pressed={selected}
			onClick={onSelect}
		>
			<b>{noteTitle(file.filePath)}</b>
			<span>{noteFolder(file.filePath)}</span>
			{deletedAt !== null && (
				<span className="deleted-note-when">Deleted {formatRelativeTime(deletedAt)}</span>
			)}
		</Button>
	)
}

function DeletedNotesContent() {
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const actors = useSyncActorNames()
	const [files, setFiles] = useState<DeletedFileInfo[] | null>(null)
	const [listError, setListError] = useState<string | null>(null)
	const [selectedPath, setSelectedPath] = useState<string | null>(null)
	const [previews, setPreviews] = useState<Record<string, PreviewState>>({})
	const [query, setQuery] = useState("")
	const [restoring, setRestoring] = useState(false)
	const [copied, showCopied] = useCopyFeedback()
	const requestedPreviews = useRef(new Set<string>())
	const deferredQuery = useDeferredValue(query.trim().toLowerCase())

	useEffect(() => {
		if (!vaultPath || !linkedVaultId) {
			setListError("This vault is not linked to Cortex Sync.")
			return
		}
		let cancelled = false
		useSyncStore
			.getState()
			.listDeletedFiles(linkedVaultId, vaultPath)
			.then((list) => {
				if (cancelled) return
				const sorted = list.toSorted(
					(left, right) =>
						(parseTimestamp(right.deletedAt) ?? 0) - (parseTimestamp(left.deletedAt) ?? 0),
				)
				setFiles(sorted)
				setSelectedPath((current) => current ?? sorted[0]?.filePath ?? null)
			})
			.catch((error: unknown) => {
				if (!cancelled) setListError(String(error))
			})
		return () => {
			cancelled = true
		}
	}, [vaultPath, linkedVaultId])

	useEffect(() => {
		if (!selectedPath || !vaultPath || !linkedVaultId) return
		if (requestedPreviews.current.has(selectedPath)) return
		requestedPreviews.current.add(selectedPath)
		setPreviews((current) => ({ ...current, [selectedPath]: { status: "loading" } }))
		useSyncStore
			.getState()
			.downloadVersion(linkedVaultId, vaultPath, selectedPath, "0")
			.then((content) =>
				setPreviews((current) => ({ ...current, [selectedPath]: { status: "ready", content } })),
			)
			.catch((error: unknown) => {
				requestedPreviews.current.delete(selectedPath)
				setPreviews((current) => ({
					...current,
					[selectedPath]: { status: "error", message: String(error) },
				}))
			})
	}, [selectedPath, vaultPath, linkedVaultId])

	const visibleFiles = useMemo(
		() =>
			(files ?? []).filter((file) =>
				deferredQuery ? file.filePath.toLowerCase().includes(deferredQuery) : true,
			),
		[files, deferredQuery],
	)
	const days = useMemo(
		() => groupByDay(visibleFiles, (file) => parseTimestamp(file.deletedAt)),
		[visibleFiles],
	)
	const selected = files?.find((file) => file.filePath === selectedPath) ?? null
	const preview = selectedPath ? previews[selectedPath] : undefined

	const handleCopy = () => {
		if (preview?.status !== "ready") return
		void getPlatform().clipboard.writeText(preview.content)
		showCopied()
	}

	const handleRestore = async () => {
		if (!selected || !vaultPath || !linkedVaultId) return
		setRestoring(true)
		try {
			await useSyncStore.getState().restoreDeletedFile(linkedVaultId, vaultPath, selected.filePath)
			const remaining = (files ?? []).filter((file) => file.filePath !== selected.filePath)
			setFiles(remaining)
			setSelectedPath(remaining[0]?.filePath ?? null)
		} catch (error) {
			void reportAppError({
				operation: "restore-deleted-note",
				source: "sync",
				cause: error,
				userMessage: "Cortex could not restore this note. Try again in a moment.",
			})
		} finally {
			setRestoring(false)
		}
	}

	const deletedBy = selected ? actors.personName(selected.lastModifiedBy) : null
	const deletedOn = selected ? actors.deviceName(selected.lastDeviceId) : null
	const deletedAt = selected ? parseTimestamp(selected.deletedAt) : null
	const meta = [
		deletedAt !== null ? `Deleted ${formatDateTime(deletedAt)}` : "Deleted",
		deletedBy ? `by ${deletedBy}` : null,
	]
		.filter(Boolean)
		.join(" ")

	return (
		<HistoryDialog
			title="Deleted notes"
			description="Preview and restore notes kept by the linked remote vault."
		>
			<div className="history-body">
				<aside className="history-rail" aria-label="Recoverable notes">
					<div className="history-rail-top">
						<InputGroup variant="search">
							<InputGroupAddon>
								<SearchIcon />
							</InputGroupAddon>
							<InputGroupInput
								autoFocus
								aria-label="Search deleted notes"
								placeholder="Search deleted notes"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
							/>
						</InputGroup>
					</div>
					<div className="history-list">
						{files === null && !listError && <HistoryLoading />}
						{files !== null && visibleFiles.length === 0 && (
							<HistoryEmpty
								title={files.length === 0 ? "No deleted notes" : "No matches"}
								description={
									files.length === 0
										? "Notes removed on any device appear here."
										: "Try another search."
								}
							/>
						)}
						{days.map((day) => (
							<section key={day.label} aria-label={day.label}>
								<HistoryDayLabel>{day.label}</HistoryDayLabel>
								{day.items.map((file) => (
									<DeletedNoteRow
										key={file.filePath}
										file={file}
										selected={file.filePath === selectedPath}
										onSelect={() => setSelectedPath(file.filePath)}
									/>
								))}
							</section>
						))}
					</div>
				</aside>

				<div className="history-pane">
					<HistoryHead title="Deleted notes" />
					{listError && <HistoryError message={listError} />}
					{selected ? (
						<>
							<div className="history-pane-head">
								<div className="history-pane-title">
									<b>{noteTitle(selected.filePath)}</b>
									<span>{[meta, deletedOn].filter(Boolean).join(" · ")}</span>
								</div>
								<Badge variant="secondary">Version {selected.version}</Badge>
							</div>
							<div className="history-pane-body">
								{preview?.status === "loading" && <HistoryLoading />}
								{preview?.status === "error" && <HistoryError message={preview.message} />}
								{preview?.status === "ready" && <NoteReadingPreview content={preview.content} />}
							</div>
							<footer className="history-foot">
								<span className="history-foot-note">
									<FolderIcon className="size-3.5" aria-hidden="true" />
									Restores to <b>{noteFolder(selected.filePath)}</b>
								</span>
								<Button
									variant="ghost"
									size="sm"
									onClick={handleCopy}
									disabled={preview?.status !== "ready"}
								>
									<CopyIcon />
									{copied ? "Copied" : "Copy text"}
								</Button>
								<Button size="sm" onClick={() => void handleRestore()} disabled={restoring}>
									{restoring ? <Spinner className="size-3" /> : <RotateCcwIcon />}
									Restore note
								</Button>
							</footer>
						</>
					) : (
						files !== null && (
							<HistoryEmpty
								title="Nothing selected"
								description="Choose a deleted note to preview it before restoring."
							/>
						)
					)}
				</div>
			</div>
		</HistoryDialog>
	)
}
