import { useRemoteVaultStore, useSyncStore, useVaultStore } from "@cortex/core"
import type { VersionInfo } from "@cortex/platform"
import { getThemeManager } from "@cortex/theme"
import {
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	ScrollArea,
	Spinner,
} from "@cortex/ui"
import type { FileDiffMetadata } from "@pierre/diffs"
import { parseDiffFromFile } from "@pierre/diffs"
import { FileDiff } from "@pierre/diffs/react"
import { Clock3, FileClock, RotateCcw, UserRound } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

function useIsDarkTheme(): boolean {
	const [isDark, setIsDark] = useState(() => getThemeManager().getActiveTheme().isDark)
	useEffect(() => {
		return getThemeManager().subscribe((theme) => setIsDark(theme.isDark))
	}, [])
	return isDark
}

function formatVersionDate(dateString: string | null): string {
	if (!dateString) return "Unknown date"
	const date = new Date(dateString)
	return date.toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	})
}

interface VersionRowProps {
	version: VersionInfo
	isSelected: boolean
	isLatest: boolean
	onSelect: () => void
}

function VersionRow({ version, isSelected, isLatest, onSelect }: VersionRowProps) {
	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={onSelect}
			className={`h-auto min-h-16 w-full flex-col items-stretch justify-center gap-1 rounded-[6px] px-3 py-2 text-left ${
				isSelected ? "bg-accent text-accent-foreground" : ""
			}`}
		>
			<div className="flex min-w-0 items-center gap-2">
				<UserRound size={18} className="shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
					{version.authorName ?? "Unknown"}
				</span>
				{isLatest && (
					<Badge variant="secondary" className="h-4 px-1.5 py-0 text-[10px]">
						Latest
					</Badge>
				)}
			</div>
			<span className="flex items-center gap-1 pl-5 text-[11px] text-muted-foreground">
				<Clock3 className="size-2.5" />
				{formatVersionDate(version.createdAt)}
			</span>
		</Button>
	)
}

interface NoteHistoryPanelProps {
	filePath: string
	open: boolean
	onOpenChange: (open: boolean) => void
}

interface NoteHistoryState {
	versions: VersionInfo[]
	selectedVersion: VersionInfo | null
	previousContent: string | null
	currentContent: string | null
	loadingVersions: boolean
	loadingDiff: boolean
	restoring: boolean
	error: string | null
}

const initialNoteHistoryState: NoteHistoryState = {
	versions: [],
	selectedVersion: null,
	previousContent: null,
	currentContent: null,
	loadingVersions: false,
	loadingDiff: false,
	restoring: false,
	error: null,
}

export function NoteHistoryPanel({ filePath, open, onOpenChange }: NoteHistoryPanelProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{open && (
				<NoteHistoryPanelContent key={filePath} filePath={filePath} onOpenChange={onOpenChange} />
			)}
		</Dialog>
	)
}

function NoteHistoryPanelContent({
	filePath,
	onOpenChange,
}: Pick<NoteHistoryPanelProps, "filePath" | "onOpenChange">) {
	const { vault } = useVaultStore()
	const { linkedVaultId } = useRemoteVaultStore()
	const { getVersionHistory, downloadVersion, restoreVersion } = useSyncStore()
	const isDark = useIsDarkTheme()

	const [state, setState] = useState<NoteHistoryState>(initialNoteHistoryState)
	const {
		versions,
		selectedVersion,
		previousContent,
		currentContent,
		loadingVersions,
		loadingDiff,
		restoring,
		error,
	} = state

	const relativeFilePath = vault?.path ? filePath.replace(`${vault.path}/`, "") : filePath
	const fileName = filePath.split("/").pop() ?? filePath

	const fileDiff = useMemo<FileDiffMetadata | null>(() => {
		if (currentContent === null) return null
		return parseDiffFromFile(
			{ name: fileName, contents: previousContent ?? "" },
			{ name: fileName, contents: currentContent },
		)
	}, [previousContent, currentContent, fileName])

	const addedLines = useMemo(
		() => fileDiff?.hunks.reduce((sum, h) => sum + h.additionLines, 0) ?? 0,
		[fileDiff],
	)
	const removedLines = useMemo(
		() => fileDiff?.hunks.reduce((sum, h) => sum + h.deletionLines, 0) ?? 0,
		[fileDiff],
	)

	const loadVersions = useCallback(async () => {
		if (!vault?.path || !linkedVaultId) {
			setState((current) => ({ ...current, error: "Vault is not linked to a remote vault" }))
			return
		}
		setState((current) => ({ ...current, loadingVersions: true, error: null }))
		try {
			const history = await getVersionHistory(linkedVaultId, vault.path, relativeFilePath)
			setState((current) => ({
				...current,
				versions: history.sort((a, b) => b.version - a.version),
			}))
		} catch (e) {
			setState((current) => ({ ...current, error: String(e) }))
		} finally {
			setState((current) => ({ ...current, loadingVersions: false }))
		}
	}, [vault?.path, linkedVaultId, relativeFilePath, getVersionHistory])

	useEffect(() => {
		void loadVersions()
	}, [loadVersions])

	const handleSelectVersion = useCallback(
		async (version: VersionInfo) => {
			if (!vault?.path || !linkedVaultId) return

			setState((current) => ({
				...current,
				selectedVersion: version,
				loadingDiff: true,
				previousContent: null,
				currentContent: null,
			}))

			try {
				const current = await downloadVersion(
					linkedVaultId,
					vault.path,
					relativeFilePath,
					String(version.version),
				)

				const versionIndex = versions.findIndex((v) => v.snapshotId === version.snapshotId)
				const previousVersion = versions[versionIndex + 1]

				if (!previousVersion) {
					setState((currentState) =>
						currentState.selectedVersion?.snapshotId === version.snapshotId
							? { ...currentState, previousContent: "", currentContent: current }
							: currentState,
					)
				} else {
					const previous = await downloadVersion(
						linkedVaultId,
						vault.path,
						relativeFilePath,
						String(previousVersion.version),
					)
					setState((currentState) =>
						currentState.selectedVersion?.snapshotId === version.snapshotId
							? { ...currentState, previousContent: previous, currentContent: current }
							: currentState,
					)
				}
			} catch (e) {
				setState((current) => ({ ...current, error: String(e) }))
			} finally {
				setState((current) =>
					current.selectedVersion?.snapshotId === version.snapshotId
						? { ...current, loadingDiff: false }
						: current,
				)
			}
		},
		[vault?.path, linkedVaultId, relativeFilePath, downloadVersion, versions],
	)

	const handleRestore = useCallback(async () => {
		if (!selectedVersion || !vault?.path || !linkedVaultId) return

		setState((current) => ({ ...current, restoring: true }))
		try {
			await restoreVersion(
				linkedVaultId,
				vault.path,
				relativeFilePath,
				String(selectedVersion.version),
			)
			onOpenChange(false)
		} catch (e) {
			setState((current) => ({ ...current, error: String(e) }))
		} finally {
			setState((current) => ({ ...current, restoring: false }))
		}
	}, [selectedVersion, vault?.path, linkedVaultId, relativeFilePath, restoreVersion, onOpenChange])

	return (
		<DialogContent className="flex h-[min(680px,calc(100vh-2rem))] flex-col gap-0 overflow-hidden p-0 md:max-w-[960px] lg:max-w-[1100px]">
			<DialogHeader className="dialog-chrome-header shrink-0 gap-1">
				<DialogTitle className="flex items-center gap-2 text-base leading-5">
					<FileClock className="size-4 text-muted-foreground" />
					Note history
				</DialogTitle>
				<DialogDescription className="truncate text-xs leading-[18px]">
					{relativeFilePath}
				</DialogDescription>
			</DialogHeader>

			<div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)] overflow-hidden">
				<aside className="flex min-h-0 flex-col overflow-hidden border-r border-border bg-muted/30">
					<div className="flex shrink-0 items-center justify-between px-4 py-3">
						<p className="m-0 text-sm font-medium text-foreground">Versions</p>
						{!loadingVersions && versions.length > 0 && (
							<span className="text-xs tabular-nums text-muted-foreground">{versions.length}</span>
						)}
					</div>

					<ScrollArea className="min-h-0 flex-1">
						<div className="flex flex-col gap-1 p-2">
							{loadingVersions && (
								<div className="flex items-center justify-center py-10">
									<Spinner className="size-4 text-muted-foreground" />
								</div>
							)}
							{!loadingVersions && versions.length === 0 && !error && (
								<div className="px-4 py-10 text-center">
									<p className="m-0 text-sm font-medium text-foreground">No history yet</p>
									<p className="m-0 mt-1 text-xs leading-[18px] text-muted-foreground">
										Synced versions of this note will appear here.
									</p>
								</div>
							)}
							{versions.map((version, index) => (
								<VersionRow
									key={version.snapshotId}
									version={version}
									isSelected={selectedVersion?.snapshotId === version.snapshotId}
									isLatest={index === 0}
									onSelect={() => handleSelectVersion(version)}
								/>
							))}
						</div>
					</ScrollArea>
				</aside>

				<section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
					<div className="flex min-h-16 shrink-0 items-center gap-4 border-b border-border px-5 py-3">
						{selectedVersion ? (
							<>
								<div className="min-w-0 flex-1">
									<p className="m-0 truncate text-sm font-medium text-foreground">
										Version {selectedVersion.version} by {selectedVersion.authorName ?? "Unknown"}
									</p>
									<p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">
										{formatVersionDate(selectedVersion.createdAt)}
										{selectedVersion.deviceName ? ` · ${selectedVersion.deviceName}` : ""}
									</p>
								</div>
								{!loadingDiff && fileDiff && (
									<div className="flex shrink-0 items-center gap-2">
										<Badge
											variant="outline"
											className="border-status-success-border bg-status-success-background text-status-success-foreground"
										>
											+{addedLines}
										</Badge>
										<Badge
											variant="outline"
											className="border-status-error-border bg-status-error-background text-status-error-foreground"
										>
											-{removedLines}
										</Badge>
									</div>
								)}
								<Button size="sm" onClick={handleRestore} disabled={restoring} className="shrink-0">
									{restoring ? <Spinner className="size-3" /> : <RotateCcw />}
									Restore version
								</Button>
							</>
						) : (
							<div>
								<p className="m-0 text-sm font-medium text-foreground">Select a version</p>
								<p className="m-0 mt-0.5 text-xs text-muted-foreground">
									Choose a snapshot to compare it with the previous version.
								</p>
							</div>
						)}
					</div>

					<div
						data-slot="note-history-diff"
						className="min-h-0 min-w-0 flex-1 overflow-auto bg-background"
					>
						{error && (
							<div className="m-5 rounded-[6px] border border-status-error-border bg-status-error-background p-3 text-sm text-status-error-foreground">
								{error}
							</div>
						)}
						{loadingDiff && (
							<div className="flex min-h-full items-center justify-center">
								<Spinner className="size-5 text-muted-foreground" />
							</div>
						)}
						{!loadingDiff && !fileDiff && !error && (
							<div className="flex min-h-full flex-col items-center justify-center gap-1 px-8 text-center">
								<p className="m-0 text-sm font-medium text-foreground">No version selected</p>
								<p className="m-0 max-w-sm text-xs leading-[18px] text-muted-foreground">
									The comparison will appear here without replacing your current note.
								</p>
							</div>
						)}
						{!loadingDiff && fileDiff && (
							<div className="min-w-full">
								<FileDiff
									fileDiff={fileDiff}
									options={{
										theme: { dark: "pierre-dark", light: "pierre-light" },
										themeType: isDark ? "dark" : "light",
										diffStyle: "unified",
										lineDiffType: "word",
										disableFileHeader: true,
										overflow: "scroll",
									}}
								/>
							</div>
						)}
					</div>
				</section>
			</div>
		</DialogContent>
	)
}
