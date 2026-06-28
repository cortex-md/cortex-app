import { executeCommand } from "@cortex/commands"
import {
	formatNoteEditedAt,
	getNotePathPresentation,
	getNoteTitleError,
	isSyncImagePath,
	loadNoteSyncAttribution,
	type NoteSyncAttribution,
	shouldIgnoreSyncPath,
	useAuthStore,
	useBookmarksStore,
	useMembersStore,
	useRemoteVaultStore,
	useSyncStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { usePluginStore } from "@cortex/plugin-host-web"
import {
	Avatar,
	AvatarFallback,
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
	Input,
} from "@cortex/ui"
import { MoreHorizontal } from "lucide-react"
import { Fragment, type Ref, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { NativeMenuActions } from "@/utils/context-menu"
import { reportAppError } from "@/utils/reportAppError"
import { buildNoteMenuItems } from "../file-explorer/NativeMenuActions"
import { NoteDropdownMenuItems } from "../file-explorer/NoteMenuItems"
import { createPluginContextMenuItems } from "../plugins/pluginContextMenu"

interface Props {
	filePath: string
	paneId?: string
	onViewHistory?: (filePath: string) => void
}

interface NoteTitleDraft {
	noteTitle: string
	title: string
	error: string | null
}

interface NoteAttributionDraft {
	key: string
	attribution: NoteSyncAttribution | null
}

const nativeMenu = new NativeMenuActions()

function hasNativeMenu(): boolean {
	return getPlatform().capabilities.includes("menu")
}

function getInitials(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean)
	if (words.length === 0) return "?"
	return words
		.slice(0, 2)
		.map((word) => word.charAt(0).toLocaleUpperCase())
		.join("")
}

interface NoteHeaderBreadcrumbProps {
	segments: ReturnType<typeof getNotePathPresentation>["segments"]
}

function NoteHeaderBreadcrumb({ segments }: NoteHeaderBreadcrumbProps) {
	return (
		<Breadcrumb className="note-header-breadcrumb">
			<BreadcrumbList className="flex-nowrap overflow-hidden">
				{segments.map((segment, index) => (
					<Fragment key={segment.id}>
						{index > 0 && <BreadcrumbSeparator />}
						<BreadcrumbItem className="min-w-0">
							<BreadcrumbPage className="truncate text-xs text-text-muted">
								{segment.label}
							</BreadcrumbPage>
						</BreadcrumbItem>
					</Fragment>
				))}
			</BreadcrumbList>
		</Breadcrumb>
	)
}

interface NoteHeaderAttributionProps {
	attribution: NoteSyncAttribution
	currentTime: number
}

function NoteHeaderAttribution({ attribution, currentTime }: NoteHeaderAttributionProps) {
	return (
		<div
			className="note-header-attribution"
			title={
				attribution.email
					? `${attribution.displayName} · ${attribution.email}`
					: attribution.displayName
			}
		>
			<Avatar size="sm" className="note-header-avatar">
				<AvatarFallback>{getInitials(attribution.displayName)}</AvatarFallback>
			</Avatar>
			<span className="note-header-attribution-text">
				Edited {formatNoteEditedAt(attribution.editedAt, () => currentTime)} by{" "}
				<strong>{attribution.displayName}</strong>
			</span>
		</div>
	)
}

interface NoteHeaderActionsProps {
	menuItems: ReturnType<typeof buildNoteMenuItems>
}

function NoteHeaderActions({ menuItems }: NoteHeaderActionsProps) {
	if (hasNativeMenu()) {
		return (
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="note-header-actions-button"
				aria-label="Note actions"
				title="Note actions"
				onClick={(event) => {
					const rect = event.currentTarget.getBoundingClientRect()
					void nativeMenu.showContextMenu({
						items: menuItems,
						position: { x: rect.right, y: rect.bottom },
					})
				}}
			>
				<MoreHorizontal className="size-[15px]" />
			</Button>
		)
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="note-header-actions-button"
					aria-label="Note actions"
					title="Note actions"
				>
					<MoreHorizontal className="size-[15px]" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<NoteDropdownMenuItems items={menuItems} />
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

interface NoteTitleInputProps {
	titleInputRef: Ref<HTMLInputElement>
	title: string
	error: string | null
	onTitleChange: (value: string) => void
	onCommit: () => void
	onReset: () => void
}

function NoteTitleInput({
	titleInputRef,
	title,
	error,
	onTitleChange,
	onCommit,
	onReset,
}: NoteTitleInputProps) {
	return (
		<div className="note-header-title-group">
			<Input
				ref={titleInputRef}
				value={title}
				aria-label="Note title"
				aria-invalid={Boolean(error)}
				spellCheck={false}
				className="note-header-title"
				onChange={(event) => onTitleChange(event.target.value)}
				onBlur={() => void onCommit()}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault()
						event.currentTarget.blur()
					}
					if (event.key === "Escape") {
						event.preventDefault()
						onReset()
						event.currentTarget.blur()
					}
				}}
			/>
			<output className="note-header-error">{error}</output>
		</div>
	)
}

export function NoteHeader({ filePath, paneId, onViewHistory }: Props) {
	const vault = useVaultStore((state) => state.vault)
	const renameFile = useVaultStore((state) => state.renameFile)
	const deleteFile = useVaultStore((state) => state.deleteFile)
	const duplicateFile = useVaultStore((state) => state.duplicateFile)
	const currentUser = useAuthStore((state) => state.user)
	const ensureMembers = useMembersStore((state) => state.ensureMembers)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const syncPreferences = useSyncStore((state) => state.syncPreferences)
	const bookmarked = useBookmarksStore((state) =>
		vault?.path ? state.isBookmarked(vault.path, filePath) : false,
	)
	const pluginContextMenuItems = usePluginStore((state) => state.contextMenuItems)
	const notePath = getNotePathPresentation(filePath, vault?.path)
	const noteTitle = notePath.title
	const relativePath = vault?.path ? filePath.replace(`${vault.path}/`, "") : filePath
	const noteMetadataRevision = useSyncStore(
		(state) => state.noteMetadataRevisions[relativePath] ?? 0,
	)
	const [titleDraft, setTitleDraft] = useState<NoteTitleDraft>(() => ({
		noteTitle,
		title: noteTitle,
		error: null,
	}))
	const [attributionDraft, setAttributionDraft] = useState<NoteAttributionDraft>({
		key: "",
		attribution: null,
	})
	const [currentTime, setCurrentTime] = useState(() => Date.now())
	const committingRef = useRef(false)
	const titleInputRef = useRef<HTMLInputElement>(null)
	const title = titleDraft.noteTitle === noteTitle ? titleDraft.title : noteTitle
	const error = titleDraft.noteTitle === noteTitle ? titleDraft.error : null
	const attributionKey = [
		syncConfig.enabled ? "sync" : "local",
		syncConfig.remoteVaultId ?? "",
		vault?.path ?? "",
		filePath,
		relativePath,
		String(noteMetadataRevision),
		currentUser?.userId ?? "",
		currentUser?.displayName ?? "",
		currentUser?.email ?? "",
	].join("\u0000")
	const attribution = attributionDraft.key === attributionKey ? attributionDraft.attribution : null

	useEffect(() => {
		let active = true
		const revision = noteMetadataRevision
		const requestKey = attributionKey
		void loadNoteSyncAttribution({
			syncEnabled: syncConfig.enabled,
			remoteVaultId: syncConfig.remoteVaultId,
			vaultPath: vault?.path ?? null,
			filePath,
			currentUser,
			loadMetadata: (vaultPath, path) => getPlatform().sync.getNoteMetadata(vaultPath, path),
			loadMembers: (vaultId) => ensureMembers(vaultId, syncConfig.serverUrl ?? undefined),
		})
			.then((nextAttribution) => {
				const latestRevision = useSyncStore.getState().noteMetadataRevisions[relativePath] ?? 0
				if (active && revision === latestRevision) {
					setAttributionDraft({ key: requestKey, attribution: nextAttribution })
				}
			})
			.catch(() => {
				if (active) setAttributionDraft({ key: requestKey, attribution: null })
			})
		return () => {
			active = false
		}
	}, [
		currentUser,
		ensureMembers,
		filePath,
		attributionKey,
		noteMetadataRevision,
		relativePath,
		syncConfig.enabled,
		syncConfig.remoteVaultId,
		syncConfig.serverUrl,
		vault?.path,
	])

	useEffect(() => {
		if (!attribution) return
		const timer = window.setInterval(() => setCurrentTime(Date.now()), 60000)
		return () => window.clearInterval(timer)
	}, [attribution])

	const handleTitleChange = useCallback(
		(value: string) => {
			setTitleDraft({
				noteTitle,
				title: value,
				error: getNoteTitleError(value),
			})
		},
		[noteTitle],
	)

	const handleCommit = useCallback(async () => {
		if (committingRef.current) return
		const nextTitle = title.trim()
		const nextName = `${nextTitle}.md`
		const validationError = getNoteTitleError(nextTitle)
		if (validationError) {
			setTitleDraft({ noteTitle, title, error: validationError })
			return
		}
		if (nextTitle === noteTitle) {
			setTitleDraft({ noteTitle, title: noteTitle, error: null })
			return
		}

		committingRef.current = true
		try {
			await renameFile(filePath, nextName)
			setTitleDraft({ noteTitle, title, error: null })
		} catch (renameError) {
			setTitleDraft({
				noteTitle,
				title,
				error: renameError instanceof Error ? renameError.message : String(renameError),
			})
		} finally {
			committingRef.current = false
		}
	}, [filePath, noteTitle, renameFile, title])

	const handleRename = useCallback(() => {
		requestAnimationFrame(() => {
			titleInputRef.current?.focus()
			titleInputRef.current?.select()
		})
	}, [])

	const handleDuplicate = useCallback(
		async (path: string) => {
			try {
				const newPath = await duplicateFile(path)
				useWorkspaceStore.getState().openTab(newPath)
			} catch (duplicateError) {
				await reportAppError({
					operation: "duplicate-note",
					source: "note-header",
					cause: duplicateError,
					userMessage: "The note could not be duplicated.",
					context: { filePath: path },
				})
			}
		},
		[duplicateFile],
	)

	const handleDelete = useCallback(
		async (path: string) => {
			const fileName = path.split("/").pop() ?? path
			const confirmed = await getPlatform().dialog.showConfirm(
				"Delete",
				`Are you sure you want to delete "${fileName}"?`,
			)
			if (!confirmed) return

			useWorkspaceStore.getState().closeTabsByPath(path)
			try {
				await deleteFile(path)
			} catch (deleteError) {
				await reportAppError({
					operation: "delete-note",
					source: "note-header",
					cause: deleteError,
					userMessage: `"${fileName}" could not be deleted.`,
					context: { filePath: path },
				})
			}
		},
		[deleteFile],
	)

	const syncIgnored = shouldIgnoreSyncPath(relativePath, syncPreferences)
	const canToggleSync = !(syncPreferences.ignoreImages && isSyncImagePath(relativePath))
	const pluginFileMenuItems = useMemo(
		() =>
			createPluginContextMenuItems(pluginContextMenuItems, "file", {
				location: "file",
				filePath,
			}),
		[pluginContextMenuItems, filePath],
	)
	const menuItems = useMemo(
		() => [
			...buildNoteMenuItems(
				{
					path: filePath,
					bookmarked,
					syncIgnored,
					showVersionHistory: attribution !== null,
					canToggleSync: Boolean(vault?.path) && canToggleSync,
				},
				{
					openInNewTab: (path) => useWorkspaceStore.getState().openTab(path, { forceNew: true }),
					openInRightSplit: (path) => {
						const workspace = useWorkspaceStore.getState()
						workspace.openInSplit(path, paneId ?? workspace.activePaneId, "horizontal")
					},
					duplicate: (path) => void handleDuplicate(path),
					copyRelativePath: (path) => {
						const value = vault?.path ? path.replace(`${vault.path}/`, "") : path
						void navigator.clipboard.writeText(value)
					},
					copyAbsolutePath: (path) => void navigator.clipboard.writeText(path),
					reveal: (path) => void getPlatform().dialog.revealFolder(path),
					showVersionHistory: (path) => onViewHistory?.(path),
					toggleBookmark: (path) => {
						executeCommand("bookmarks.toggle", {
							source: "menu",
							payload: { filePath: path },
						})
					},
					toggleSyncIgnore: (path, ignored) => {
						if (!vault?.path) return
						const value = path.replace(`${vault.path}/`, "")
						void useSyncStore.getState().toggleExcludedPath(value, ignored)
					},
					rename: handleRename,
					delete: (path) => void handleDelete(path),
				},
			),
			...pluginFileMenuItems,
		],
		[
			attribution,
			bookmarked,
			canToggleSync,
			filePath,
			handleDelete,
			handleDuplicate,
			handleRename,
			onViewHistory,
			paneId,
			pluginFileMenuItems,
			syncIgnored,
			vault?.path,
		],
	)

	const handleResetTitle = useCallback(() => {
		setTitleDraft({ noteTitle, title: noteTitle, error: null })
	}, [noteTitle])

	return (
		<header className="note-header">
			<div className="note-header-meta-row">
				<NoteHeaderBreadcrumb segments={notePath.segments} />
				<div className="note-header-meta-actions">
					{attribution && (
						<NoteHeaderAttribution attribution={attribution} currentTime={currentTime} />
					)}
					<NoteHeaderActions menuItems={menuItems} />
				</div>
			</div>
			<NoteTitleInput
				titleInputRef={titleInputRef}
				title={title}
				error={error}
				onTitleChange={handleTitleChange}
				onCommit={handleCommit}
				onReset={handleResetTitle}
			/>
		</header>
	)
}
