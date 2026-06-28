import { useRemoteVaultStore, useSyncStore, useVaultStore } from "@cortex/core"
import type { DeletedFileInfo } from "@cortex/platform"
import {
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	ScrollArea,
	Spinner,
} from "@cortex/ui"
import { Clock, FileText, FolderOpen, RotateCcw, Search, Trash2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

function formatDeletedDate(dateString: string | null): string {
	if (!dateString) return "Unknown date"
	const date = new Date(dateString)
	const now = new Date()
	const diffMs = now.getTime() - date.getTime()
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

	if (diffDays === 0) {
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
		if (diffHours === 0) {
			const diffMins = Math.floor(diffMs / (1000 * 60))
			return `${diffMins}m ago`
		}
		return `${diffHours}h ago`
	}
	if (diffDays === 1) return "Yesterday"
	if (diffDays < 30) return `${diffDays}d ago`

	return date.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	})
}

function formatFileSize(bytes: number | null): string {
	if (bytes === null || bytes === undefined) return ""
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function extractFileName(filePath: string): string {
	return filePath.split("/").pop() ?? filePath
}

function extractDirectory(filePath: string): string {
	const parts = filePath.split("/")
	if (parts.length <= 1) return ""
	return parts.slice(0, -1).join("/")
}

interface DeletedFileRowProps {
	file: DeletedFileInfo
	isSelected: boolean
	onSelect: () => void
	onRestore: () => void
	restoring: boolean
}

function DeletedFileRow({ file, isSelected, onSelect, onRestore, restoring }: DeletedFileRowProps) {
	const fileName = extractFileName(file.filePath)
	const directory = extractDirectory(file.filePath)

	return (
		<div
			data-selected={isSelected}
			className={`group flex items-start gap-1 rounded-[6px] p-1 transition-colors ${
				isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
			}`}
		>
			<Button
				variant="ghost"
				size="sm"
				onClick={onSelect}
				className="h-auto min-w-0 flex-1 items-start justify-start gap-2 rounded-[6px] px-2 py-2 text-left hover:bg-transparent"
			>
				<FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
				<div className="min-w-0 flex-1">
					<p className="m-0 truncate text-xs font-medium text-foreground">{fileName}</p>
					{directory && (
						<p className="m-0 mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
							<FolderOpen className="size-2.5 shrink-0" />
							{directory}
						</p>
					)}
					<div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
						<span className="flex items-center gap-1">
							<Clock className="size-2.5" />
							{formatDeletedDate(file.deletedAt)}
						</span>
						{file.sizeBytes !== null && <span>{formatFileSize(file.sizeBytes)}</span>}
						<span>v{file.version}</span>
					</div>
				</div>
			</Button>
			<Button
				variant="ghost"
				size="icon-xs"
				onClick={onRestore}
				disabled={restoring}
				aria-label={`Restore ${fileName}`}
				className="mt-1 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-data-[selected=true]:opacity-100"
			>
				{restoring ? <Spinner className="size-3" /> : <RotateCcw />}
			</Button>
		</div>
	)
}

interface DeletedNotesPanelProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

interface DeletedNotesState {
	deletedFiles: DeletedFileInfo[]
	selectedFile: DeletedFileInfo | null
	previewContent: string | null
	loading: boolean
	loadingPreview: boolean
	restoringPath: string | null
	error: string | null
	searchQuery: string
}

const initialDeletedNotesState: DeletedNotesState = {
	deletedFiles: [],
	selectedFile: null,
	previewContent: null,
	loading: false,
	loadingPreview: false,
	restoringPath: null,
	error: null,
	searchQuery: "",
}

export function DeletedNotesPanel({ open, onOpenChange }: DeletedNotesPanelProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{open && <DeletedNotesPanelContent />}
		</Dialog>
	)
}

function DeletedNotesPanelContent() {
	const { vault } = useVaultStore()
	const { linkedVaultId } = useRemoteVaultStore()
	const { listDeletedFiles, restoreDeletedFile, downloadVersion } = useSyncStore()

	const [state, setState] = useState<DeletedNotesState>(initialDeletedNotesState)
	const {
		deletedFiles,
		selectedFile,
		previewContent,
		loading,
		loadingPreview,
		restoringPath,
		error,
		searchQuery,
	} = state

	const loadDeletedFiles = useCallback(async () => {
		if (!vault?.path || !linkedVaultId) {
			setState((current) => ({ ...current, error: "Vault is not linked to a remote vault" }))
			return
		}
		setState((current) => ({ ...current, loading: true, error: null }))
		try {
			const files = await listDeletedFiles(linkedVaultId, vault.path)
			files.sort((a, b) => {
				const dateA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0
				const dateB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0
				return dateB - dateA
			})
			setState((current) => ({ ...current, deletedFiles: files }))
		} catch (e) {
			setState((current) => ({ ...current, error: String(e) }))
		} finally {
			setState((current) => ({ ...current, loading: false }))
		}
	}, [vault?.path, linkedVaultId, listDeletedFiles])

	useEffect(() => {
		void loadDeletedFiles()
	}, [loadDeletedFiles])

	const filteredFiles = useMemo(() => {
		if (!searchQuery.trim()) return deletedFiles
		const query = searchQuery.toLowerCase()
		return deletedFiles.filter((f) => f.filePath.toLowerCase().includes(query))
	}, [deletedFiles, searchQuery])

	const handleSelectFile = useCallback(
		async (file: DeletedFileInfo) => {
			if (!vault?.path || !linkedVaultId) return

			setState((current) => ({
				...current,
				selectedFile: file,
				loadingPreview: true,
				previewContent: null,
			}))

			try {
				const content = await downloadVersion(linkedVaultId, vault.path, file.filePath, "0")
				setState((current) =>
					current.selectedFile?.filePath === file.filePath
						? { ...current, previewContent: content }
						: current,
				)
			} catch (e) {
				setState((current) =>
					current.selectedFile?.filePath === file.filePath
						? { ...current, previewContent: `Failed to load preview: ${String(e)}` }
						: current,
				)
			} finally {
				setState((current) =>
					current.selectedFile?.filePath === file.filePath
						? { ...current, loadingPreview: false }
						: current,
				)
			}
		},
		[vault?.path, linkedVaultId, downloadVersion],
	)

	const handleRestore = useCallback(
		async (file: DeletedFileInfo) => {
			if (!vault?.path || !linkedVaultId) return

			setState((current) => ({ ...current, restoringPath: file.filePath }))
			try {
				await restoreDeletedFile(linkedVaultId, vault.path, file.filePath)
				setState((current) => ({
					...current,
					deletedFiles: current.deletedFiles.filter((entry) => entry.filePath !== file.filePath),
					selectedFile:
						current.selectedFile?.filePath === file.filePath ? null : current.selectedFile,
					previewContent:
						current.selectedFile?.filePath === file.filePath ? null : current.previewContent,
				}))
			} catch (e) {
				setState((current) => ({ ...current, error: String(e) }))
			} finally {
				setState((current) => ({ ...current, restoringPath: null }))
			}
		},
		[vault?.path, linkedVaultId, restoreDeletedFile],
	)

	return (
		<DialogContent className="flex h-[min(680px,calc(100vh-2rem))] flex-col gap-0 overflow-hidden p-0 md:max-w-[960px] lg:max-w-[1100px]">
			<DialogHeader className="dialog-chrome-header shrink-0 gap-1">
				<DialogTitle className="flex items-center gap-2 text-base leading-5">
					<Trash2 className="size-4 text-muted-foreground" />
					Deleted notes
				</DialogTitle>
				<DialogDescription className="text-xs leading-[18px]">
					Preview and restore notes retained by the linked remote vault.
				</DialogDescription>
			</DialogHeader>

			<div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)] overflow-hidden">
				<aside className="flex min-h-0 flex-col overflow-hidden border-r border-border bg-muted/30">
					<div className="shrink-0 space-y-3 border-b border-border px-4 py-3">
						<div className="flex items-center justify-between">
							<p className="m-0 text-xs font-medium text-foreground">Recoverable notes</p>
							{!loading && deletedFiles.length > 0 && (
								<Badge variant="secondary" className="h-5 px-1.5 py-0 text-[10px]">
									{deletedFiles.length}
								</Badge>
							)}
						</div>
						<InputGroup variant="search" size="sm">
							<InputGroupAddon>
								<Search />
							</InputGroupAddon>
							<InputGroupInput
								aria-label="Search deleted notes"
								placeholder="Search deleted notes"
								value={searchQuery}
								onChange={(event) =>
									setState((current) => ({ ...current, searchQuery: event.target.value }))
								}
							/>
						</InputGroup>
					</div>

					<ScrollArea className="min-h-0 flex-1">
						<div className="flex flex-col gap-1 p-2">
							{loading && (
								<div className="flex items-center justify-center py-10">
									<Spinner className="size-4 text-muted-foreground" />
								</div>
							)}
							{!loading && filteredFiles.length === 0 && !error && (
								<div className="px-4 py-10 text-center">
									<p className="m-0 text-sm font-medium text-foreground">
										{searchQuery ? "No matching notes" : "Nothing to recover"}
									</p>
									<p className="m-0 mt-1 text-xs leading-[18px] text-muted-foreground">
										{searchQuery
											? "Try a different file or folder name."
											: "Deleted synced notes will appear here while retained."}
									</p>
								</div>
							)}
							{filteredFiles.map((file) => (
								<DeletedFileRow
									key={file.filePath}
									file={file}
									isSelected={selectedFile?.filePath === file.filePath}
									onSelect={() => handleSelectFile(file)}
									onRestore={() => handleRestore(file)}
									restoring={restoringPath === file.filePath}
								/>
							))}
						</div>
					</ScrollArea>
				</aside>

				<section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
					<div className="flex min-h-16 shrink-0 items-center gap-4 border-b border-border px-5 py-3">
						{selectedFile ? (
							<>
								<div className="min-w-0 flex-1">
									<p className="m-0 truncate text-sm font-medium text-foreground">
										{extractFileName(selectedFile.filePath)}
									</p>
									<p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">
										{selectedFile.filePath} · Deleted {formatDeletedDate(selectedFile.deletedAt)}
									</p>
								</div>
								<Badge variant="outline" className="shrink-0">
									Version {selectedFile.version}
								</Badge>
								<Button
									size="sm"
									onClick={() => handleRestore(selectedFile)}
									disabled={restoringPath === selectedFile.filePath}
									className="shrink-0"
								>
									{restoringPath === selectedFile.filePath ? (
										<Spinner className="size-3" />
									) : (
										<RotateCcw />
									)}
									Restore note
								</Button>
							</>
						) : (
							<div>
								<p className="m-0 text-sm font-medium text-foreground">Select a note</p>
								<p className="m-0 mt-0.5 text-xs text-muted-foreground">
									Choose a deleted note to inspect it before restoring.
								</p>
							</div>
						)}
					</div>

					<div
						data-slot="deleted-note-preview"
						className="min-h-0 min-w-0 flex-1 overflow-auto bg-background"
					>
						{error && (
							<div className="m-5 rounded-[6px] border border-status-error-border bg-status-error-background p-3 text-sm text-status-error-foreground">
								{error}
							</div>
						)}
						{loadingPreview && (
							<div className="flex min-h-full items-center justify-center">
								<Spinner className="size-5 text-muted-foreground" />
							</div>
						)}
						{!loadingPreview && previewContent !== null && (
							<pre className="m-0 min-w-full whitespace-pre-wrap break-words p-5 font-mono text-xs leading-5 text-foreground">
								{previewContent}
							</pre>
						)}
						{!loadingPreview && previewContent === null && !error && (
							<div className="flex min-h-full flex-col items-center justify-center gap-1 px-8 text-center">
								<p className="m-0 text-sm font-medium text-foreground">No preview selected</p>
								<p className="m-0 max-w-sm text-xs leading-[18px] text-muted-foreground">
									Restoring creates the note again at its original vault path.
								</p>
							</div>
						)}
					</div>
				</section>
			</div>
		</DialogContent>
	)
}
