import { executeCommand } from "@cortex/commands"
import {
	formatNoteEditedAt,
	getNoteFolderSegments,
	getNotePathPresentation,
	getNoteTitleError,
	getParentPath,
	loadNoteSyncAttribution,
	type NoteSyncAttribution,
	openDatabaseView,
	toVaultRelativePath,
	useAccountStore,
	useAuthStore,
	useBookmarksStore,
	useCanReadVaultPath,
	useCanWriteVaultPath,
	useCollabNoteState,
	useDatabaseStore,
	useMembersStore,
	useRemoteVaultStore,
	useSyncStore,
	useVaultStore,
} from "@cortex/core"
import type { CollabPeer, VaultMember } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import {
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
	SimpleTooltip,
} from "@cortex/ui"
import { BookmarkIcon, LockIcon, MoreHorizontal, Table2Icon } from "lucide-react"
import { Fragment, memo, type Ref, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMinuteNow } from "@/hooks/useMinuteNow"
import type { MenuItem } from "@/utils/context-menu"
import { MenuItemList } from "../context-menu/useContextMenu"
import { buildFileMenuItems } from "../file-explorer/fileMenu"
import { memberDisplayName, useMemberDirectory } from "../sync/memberDirectory"
import { type FacepileUser, UserAvatar, UserFacepile } from "../sync/UserAvatar"

interface Props {
	filePath: string
	paneId?: string
}

interface NoteAttributionDraft {
	key: string
	attribution: NoteSyncAttribution | null
}

interface NoteHeaderBreadcrumbProps {
	segments: ReturnType<typeof getNotePathPresentation>["segments"]
}

function NoteHeaderBreadcrumb({ segments }: NoteHeaderBreadcrumbProps) {
	if (segments.length === 0) return null
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
}

function NoteHeaderAttribution({ attribution }: NoteHeaderAttributionProps) {
	const currentTime = useMinuteNow()
	const ownAvatarUrl = useAccountStore((state) =>
		state.profile?.userId === attribution.actorId ? state.profile.avatarUrl : null,
	)
	return (
		<SimpleTooltip
			label={
				attribution.email
					? `${attribution.displayName} · ${attribution.email}`
					: attribution.displayName
			}
			side="bottom"
		>
			<div className="note-header-attribution">
				<UserAvatar
					size="sm"
					name={attribution.displayName}
					avatarUrl={attribution.avatarUrl ?? ownAvatarUrl}
					className="note-header-avatar"
				/>
				<span className="note-header-attribution-text">
					Edited {formatNoteEditedAt(attribution.editedAt, () => currentTime)} by{" "}
					<strong>{attribution.displayName}</strong>
				</span>
			</div>
		</SimpleTooltip>
	)
}

function DatabaseViewNoteAction({ filePath }: { filePath: string }) {
	const isViewNote = useDatabaseStore((state) => state.viewNotePaths.includes(filePath))
	if (!isViewNote) return null
	return (
		<Button
			variant="ghost"
			size="xs"
			className="note-header-actions-button"
			onClick={() => openDatabaseView(getParentPath(filePath))}
		>
			<Table2Icon />
			Open database
		</Button>
	)
}

function NoteReadOnlyBadge({ noAccess }: { noAccess: boolean }) {
	return (
		<SimpleTooltip
			label={
				noAccess
					? "This folder is restricted to other members. Changes here stay on this device and are not synced."
					: "You can view this note but not change it. Ask a vault admin for edit access."
			}
			side="bottom"
		>
			<span className="note-header-read-only">
				<LockIcon className="size-[11px]" />
				{noAccess ? "No access · not synced" : "Read only"}
			</span>
		</SimpleTooltip>
	)
}

function toLiveFacepileUsers(
	peers: readonly CollabPeer[],
	currentUserId: string | null,
	members: ReadonlyMap<string, VaultMember>,
): FacepileUser[] {
	const seen = new Set<string>()
	const users: FacepileUser[] = []
	for (const peer of peers) {
		if (peer.userId === currentUserId || seen.has(peer.userId)) continue
		seen.add(peer.userId)
		const member = members.get(peer.userId)
		users.push({
			userId: peer.userId,
			name: member ? memberDisplayName(member) : peer.displayName,
			avatarUrl: member?.avatarUrl ?? peer.avatarUrl,
		})
	}
	return users
}

interface NotePresenceProps {
	relativePath: string
	livePeers: readonly CollabPeer[] | null
}

function NotePresence({ relativePath, livePeers }: NotePresenceProps) {
	const presence = useMembersStore((state) => state.presence)
	const members = useMemberDirectory()
	const currentUserId = useAuthStore((state) => state.user?.userId ?? null)
	const viewers = useMemo<FacepileUser[]>(() => {
		if (livePeers) return toLiveFacepileUsers(livePeers, currentUserId, members)
		const seen = new Set<string>()
		const users: FacepileUser[] = []
		for (const peer of presence) {
			if (peer.filePath !== relativePath || peer.userId === currentUserId) continue
			if (seen.has(peer.userId)) continue
			seen.add(peer.userId)
			const member = members.get(peer.userId)
			users.push({
				userId: peer.userId,
				name: member ? memberDisplayName(member) : "Vault member",
				avatarUrl: member?.avatarUrl ?? null,
			})
		}
		return users
	}, [currentUserId, livePeers, members, presence, relativePath])
	if (viewers.length === 0) return null
	return (
		<UserFacepile
			users={viewers}
			className="note-header-presence"
			label={`${livePeers ? "Editing live" : "Also here"}: ${viewers.map((viewer) => viewer.name).join(", ")}`}
		/>
	)
}

interface NoteCollaboratorsProps {
	filePath: string
	relativePath: string
	syncLinked: boolean
}

function NoteCollaborators({ filePath, relativePath, syncLinked }: NoteCollaboratorsProps) {
	const snapshot = useCollabNoteState(filePath)?.snapshot ?? null
	const livePeers = snapshot?.status === "live" ? snapshot.present : null
	return <>{syncLinked && <NotePresence relativePath={relativePath} livePeers={livePeers} />}</>
}

interface NoteHeaderActionsProps {
	filePath: string
	paneId?: string
	onRename: () => void
}

function NoteBookmarkButton({ filePath }: { filePath: string }) {
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const bookmarked = useBookmarksStore((state) =>
		vaultPath ? state.isBookmarked(vaultPath, filePath) : false,
	)
	const label = bookmarked ? "Remove bookmark" : "Add bookmark"
	return (
		<SimpleTooltip label={label} side="bottom">
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				className="note-header-actions-button"
				data-active={bookmarked || undefined}
				aria-label={label}
				aria-pressed={bookmarked}
				onClick={() =>
					executeCommand("bookmarks.toggle", { source: "menu", payload: { filePath } })
				}
			>
				<BookmarkIcon />
			</Button>
		</SimpleTooltip>
	)
}

function NoteHeaderActions({ filePath, paneId, onRename }: NoteHeaderActionsProps) {
	const [items, setItems] = useState<MenuItem[] | null>(null)
	return (
		<>
			<NoteBookmarkButton filePath={filePath} />
			<DropdownMenu
				modal={false}
				open={items !== null}
				onOpenChange={(open) =>
					setItems(
						open
							? buildFileMenuItems({ filePath, isDirectory: false }, { paneId, onRename })
							: null,
					)
				}
			>
				<SimpleTooltip label="Note actions" side="bottom">
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							className="note-header-actions-button"
							aria-label="Note actions"
						>
							<MoreHorizontal />
						</Button>
					</DropdownMenuTrigger>
				</SimpleTooltip>
				<DropdownMenuContent align="end" sideOffset={4} className="w-56">
					{items && <MenuItemList items={items} />}
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	)
}

interface NoteTitleInputProps {
	titleInputRef: Ref<HTMLInputElement>
	noteTitle: string
	readOnly: boolean
	onCommit: (title: string) => Promise<string | null>
}

function NoteTitleInput({ titleInputRef, noteTitle, readOnly, onCommit }: NoteTitleInputProps) {
	const [error, setError] = useState<string | null>(null)
	return (
		<div className="note-header-title-group">
			<Input
				ref={titleInputRef}
				defaultValue={noteTitle}
				aria-label="Note title"
				aria-invalid={Boolean(error)}
				readOnly={readOnly}
				spellCheck={false}
				className="note-header-title"
				onChange={(event) => setError(getNoteTitleError(event.target.value))}
				onBlur={(event) => {
					void onCommit(event.currentTarget.value).then(setError)
				}}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault()
						event.currentTarget.blur()
					}
					if (event.key === "Escape") {
						event.preventDefault()
						event.currentTarget.value = noteTitle
						setError(null)
						event.currentTarget.blur()
					}
				}}
			/>
			<output className="note-header-error">{error}</output>
		</div>
	)
}

function NoteHeaderView({ filePath, paneId }: Props) {
	const vault = useVaultStore((state) => state.vault)
	const renameFile = useVaultStore((state) => state.renameFile)
	const currentUser = useAuthStore((state) => state.user)
	const ensureMembers = useMembersStore((state) => state.ensureMembers)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const readOnly = !useCanWriteVaultPath(filePath)
	const noAccess = !useCanReadVaultPath(filePath)
	const notePath = getNotePathPresentation(filePath, vault?.path)
	const noteTitle = notePath.title
	const relativePath = vault?.path
		? (toVaultRelativePath(filePath, vault.path) ?? filePath)
		: filePath
	const noteMetadataRevision = useSyncStore(
		(state) => state.noteMetadataRevisions[relativePath] ?? 0,
	)
	const [attributionDraft, setAttributionDraft] = useState<NoteAttributionDraft>({
		key: "",
		attribution: null,
	})
	const committingRef = useRef(false)
	const titleInputRef = useRef<HTMLInputElement>(null)
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

	const handleCommit = useCallback(
		async (value: string): Promise<string | null> => {
			const nextTitle = value.trim()
			const validationError = getNoteTitleError(nextTitle)
			if (validationError) return validationError
			if (nextTitle === noteTitle || committingRef.current || readOnly) return null
			committingRef.current = true
			try {
				await renameFile(filePath, `${nextTitle}.md`)
				return null
			} catch (renameError) {
				return renameError instanceof Error ? renameError.message : String(renameError)
			} finally {
				committingRef.current = false
			}
		},
		[filePath, noteTitle, readOnly, renameFile],
	)

	const handleRename = useCallback(() => {
		requestAnimationFrame(() => {
			titleInputRef.current?.focus()
			titleInputRef.current?.select()
		})
	}, [])

	return (
		<header className="note-header">
			<div className="note-header-meta-row">
				<NoteHeaderBreadcrumb segments={getNoteFolderSegments(filePath, vault?.path)} />
				<div className="note-header-meta-actions">
					<NoteCollaborators
						filePath={filePath}
						relativePath={relativePath}
						syncLinked={Boolean(syncConfig.enabled && syncConfig.remoteVaultId)}
					/>
					{readOnly && <NoteReadOnlyBadge noAccess={noAccess} />}
					<DatabaseViewNoteAction filePath={filePath} />
					<NoteHeaderActions filePath={filePath} paneId={paneId} onRename={handleRename} />
				</div>
			</div>
			<NoteTitleInput
				key={noteTitle}
				titleInputRef={titleInputRef}
				noteTitle={noteTitle}
				readOnly={readOnly}
				onCommit={handleCommit}
			/>
			{attribution && <NoteHeaderAttribution attribution={attribution} />}
		</header>
	)
}

export const NoteHeader = memo(NoteHeaderView)
