import { executeCommand } from "@cortex/commands"
import { useHotkeysStore } from "@cortex/commands/hotkeys"
import {
	openWikiLink,
	type Tab,
	useCanWriteVaultPath,
	useCollabNote,
	useEditorStore,
} from "@cortex/core"
import { clipboardImageExtension } from "@cortex/editor/clipboard"
import { readOnlyDocumentExtension } from "@cortex/editor/collab"
import { EditorView } from "@cortex/editor/editor-view"
import { inlineTagClickExtension } from "@cortex/editor/inline-tags"
import { reconfigureMarkdownKeymap } from "@cortex/editor/keymap"
import {
	type MentionMenuState,
	mentionAutocompleteExtension,
	mentionHoverExtension,
} from "@cortex/editor/mentions"
import { revealLine } from "@cortex/editor/navigation-commands"
import { ReadingView } from "@cortex/editor/reading-view"
import { searchHighlightExtension } from "@cortex/editor/search-commands"
import {
	type SelectionToolbarState,
	selectionToolbarExtension,
} from "@cortex/editor/selection-toolbar"
import { SideBySideView } from "@cortex/editor/side-by-side-view"
import { type SlashCommandMenuState, slashCommandExtension } from "@cortex/editor/slash-commands"
import type {
	CursorInfo,
	EditorConfig,
	EditorExtensionFactory,
	EditorRuntimeView,
} from "@cortex/editor/types"
import { getPlatform } from "@cortex/platform"
import { registerEditorView, setEditorViewRef } from "@cortex/plugin-host-core"
import {
	createFrontmatterExtension,
	updateFrontmatterEditorState,
} from "@cortex/properties/codemirror"
import { useSettingsStore } from "@cortex/settings"
import { taskRefAtOffset } from "@cortex/tasks"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	getMentionMenuItems,
	getMentionPersonPreview,
	hasMentionCandidates,
	MentionMenu,
} from "../comments/MentionMenu"
import { useCommentEditorAnchors } from "../comments/useCommentEditorAnchors"
import { NotePropertiesPanel } from "../properties/NotePropertiesPanel"
import { openTagView } from "../tags/tagWorkspaceView"
import { toggleTaskInNote } from "../tasks/taskModel"
import { insertTemplateIntoNote, TEMPLATE_SLASH_PREFIX } from "../templates/insertTemplate"
import { EditorContextMenu } from "./EditorContextMenu"
import { getSlashCommandItems } from "./markdownFormatActions"
import { NoteFindBar } from "./NoteFindBar"
import { NoteHeader } from "./NoteHeader"
import { NoteUnavailable } from "./NoteUnavailable"
import { createNoteCodeBlockEmbeds, resolveNoteImageUrl } from "./noteEditorAssets"
import { SelectionToolbar } from "./SelectionToolbar"
import { SlashCommandMenu } from "./SlashCommandMenu"
import { useImagePaste } from "./useImagePaste"
import { useNoteDocumentSession } from "./useNoteDocumentSession"
import { cortexVimCommandProvider } from "./vimCommandProvider"

export interface TabEditorProps {
	tab: Tab
	paneId: string
	isActive: boolean
	editorConfig: EditorConfig
	onCursorChange: (cursor: CursorInfo) => void
}

export function ActiveTabEditor({
	tab,
	paneId,
	isActive,
	editorConfig,
	onCursorChange,
}: TabEditorProps) {
	const mode = useEditorStore((s) => s.mode)
	const canWritePath = useCanWriteVaultPath(tab.filePath)
	const collabNote = useCollabNote(tab.filePath, isActive)
	const collabBinding = collabNote?.binding ?? null
	const readOnly = !canWritePath || (collabBinding !== null && !collabNote?.snapshot.canWrite)
	const viewRef = useRef<EditorRuntimeView | null>(null)
	const { documentState, loadError, frontmatterStateRef, handleChange } = useNoteDocumentSession({
		filePath: tab.filePath,
		isActive,
		live: collabBinding !== null,
		mode,
		viewRef,
	})
	const [slashCommandState, setSlashCommandState] = useState<SlashCommandMenuState | null>(null)
	const [mentionMenuState, setMentionMenuState] = useState<MentionMenuState | null>(null)
	const commentAnchorsExtension = useCommentEditorAnchors({
		filePath: tab.filePath,
		isActive,
		viewRef,
	})
	const getEditorView = useCallback(() => viewRef.current, [])
	const vimCommandProvider = editorConfig.vimMode ? cortexVimCommandProvider : null
	const slashCommandsEnabled = useSettingsStore((s) => s.settings.editor.slashCommands)
	const markdownToolbarEnabled = useSettingsStore((s) => s.settings.editor.markdownToolbar)
	const [selectionToolbarState, setSelectionToolbarState] = useState<SelectionToolbarState | null>(
		null,
	)
	const selectionToolbarMenuOpenRef = useRef(false)
	const showSelectionToolbar =
		isActive &&
		!readOnly &&
		(mode === "source" || mode === "live-preview" || mode === "side-by-side")
	const codeBlockEmbeds = useMemo(() => createNoteCodeBlockEmbeds(tab.filePath), [tab.filePath])

	const formatBindingsSnapshot = useHotkeysStore((s) =>
		s.bindings
			.flatMap((binding) =>
				binding.scope === "editor" ? [`${binding.id}=${binding.keys}:${binding.enabled}`] : [],
			)
			.join(","),
	)

	const handleImagePaste = useImagePaste(tab.filePath)

	const handleSlashCommandStateChange = useCallback((state: SlashCommandMenuState | null) => {
		setSlashCommandState(state)
	}, [])

	const editorExtensions = useMemo<EditorExtensionFactory[]>(
		() => [
			clipboardImageExtension(handleImagePaste),
			createFrontmatterExtension(),
			(runtime) =>
				slashCommandExtension(runtime, {
					enabled: () => useSettingsStore.getState().settings.editor.slashCommands,
					getItems: getSlashCommandItems,
					onStateChange: handleSlashCommandStateChange,
					onExecuteCommand: executeSlashCommand,
				}),
			(runtime) =>
				mentionAutocompleteExtension(runtime, {
					enabled: hasMentionCandidates,
					getItems: getMentionMenuItems,
					onStateChange: setMentionMenuState,
				}),
			(runtime) => mentionHoverExtension(runtime, { getPerson: getMentionPersonPreview }),
			commentAnchorsExtension,
			searchHighlightExtension,
			inlineTagClickExtension(openNoteTag),
			(runtime) =>
				selectionToolbarExtension(runtime, {
					keepOpen: () => selectionToolbarMenuOpenRef.current,
					onStateChange: setSelectionToolbarState,
				}),
			...(readOnly ? [readOnlyDocumentExtension] : []),
		],
		[commentAnchorsExtension, handleImagePaste, handleSlashCommandStateChange, readOnly],
	)

	const handleExternalLinkClick = useCallback((url: string) => {
		void getPlatform().app.openExternalUrl(url)
	}, [])

	const handleTaskCheckboxToggle = useCallback(
		(offset: number) => {
			if (readOnly || !documentState) return
			const ref = taskRefAtOffset(tab.filePath, documentState.body, offset)
			if (!ref) return
			const { rawContent, body } = documentState.projection
			const frontmatter = rawContent.slice(0, rawContent.length - body.length)
			void toggleTaskInNote({ ...ref, line: ref.line + frontmatter.split("\n").length - 1 })
		},
		[documentState, readOnly, tab.filePath],
	)

	const handleWikiLinkClick = useCallback(
		(target: string) => void openWikiLink(target, { paneId }),
		[paneId],
	)

	const revealRequest = useEditorStore((s) =>
		s.revealRequest?.filePath === tab.filePath ? s.revealRequest : null,
	)
	useEffect(() => {
		const view = viewRef.current
		if (!revealRequest || !isActive || !view) return
		useEditorStore.getState().clearReveal(revealRequest.requestId)
		void revealLine(view, revealRequest.line)
	}, [revealRequest, isActive])

	const handleViewReady = useCallback(
		(view: EditorRuntimeView) => {
			viewRef.current = view
			const pendingReveal = useEditorStore.getState().revealRequest
			if (pendingReveal?.filePath === tab.filePath) {
				useEditorStore.getState().clearReveal(pendingReveal.requestId)
				void revealLine(view, pendingReveal.line)
			}
			registerEditorView(view as never)
			void updateFrontmatterEditorState(
				view,
				frontmatterStateRef.current.meta,
				frontmatterStateRef.current.error,
			)
			if (isActive) setEditorViewRef(view as never)
			void reconfigureMarkdownKeymap(
				view as EditorRuntimeView,
				getEditorHotkeyBindings(),
				executeEditorHotkeyCommand,
			)
		},
		[isActive, tab.filePath, frontmatterStateRef],
	)

	// biome-ignore lint/correctness/useExhaustiveDependencies: formatBindingsSnapshot is an intentional change-signal; bindings are read fresh from store
	useEffect(() => {
		const view = viewRef.current
		if (!view) return
		void reconfigureMarkdownKeymap(
			view as EditorRuntimeView,
			getEditorHotkeyBindings(),
			executeEditorHotkeyCommand,
		)
	}, [formatBindingsSnapshot])

	useEffect(() => {
		if (isActive && viewRef.current) {
			setEditorViewRef(viewRef.current as never)
		}
	}, [isActive])

	return (
		<>
			<EditorContextMenu getEditorView={getEditorView}>
				<div
					className="absolute inset-0 flex flex-col"
					style={{ display: isActive ? "flex" : "none" }}
					aria-hidden={!isActive}
				>
					{documentState === null ? (
						loadError !== null ? (
							<NoteUnavailable filePath={tab.filePath} message={loadError} />
						) : (
							<div className="flex-1 bg-bg-primary" />
						)
					) : (
						<div className="note-document-scroll">
							{isActive && <NoteFindBar filePath={tab.filePath} getEditorView={getEditorView} />}
							<NoteHeader filePath={tab.filePath} paneId={paneId} />
							<NotePropertiesPanel
								filePath={tab.filePath}
								projection={documentState.projection}
								readOnly={readOnly}
							/>
							<div className="note-document-surface">
								{mode === "reading" ? (
									<ReadingView
										content={documentState.body}
										filePath={tab.filePath}
										resolveImageUrl={resolveNoteImageUrl}
										scrollMode="parent"
										codeBlockEmbeds={codeBlockEmbeds}
										onExternalLinkClick={handleExternalLinkClick}
										onWikiLinkClick={handleWikiLinkClick}
										onTagClick={openNoteTag}
										onTaskCheckboxToggle={handleTaskCheckboxToggle}
									/>
								) : mode === "side-by-side" ? (
									<SideBySideView
										key={readOnly ? "read-only" : "editable"}
										content={documentState.body}
										filePath={tab.filePath}
										editorConfig={editorConfig}
										extraExtensions={editorExtensions}
										codeBlockEmbeds={codeBlockEmbeds}
										resolveImageUrl={resolveNoteImageUrl}
										vimCommandProvider={vimCommandProvider}
										commandExecutor={executeEditorHotkeyCommand}
										collab={collabBinding}
										scrollMode="parent"
										onChange={handleChange}
										onViewReady={handleViewReady}
										onExternalLinkClick={handleExternalLinkClick}
										onWikiLinkClick={handleWikiLinkClick}
										onTagClick={openNoteTag}
									/>
								) : (
									<EditorView
										key={readOnly ? "read-only" : "editable"}
										content={documentState.body}
										filePath={tab.filePath}
										editorConfig={editorConfig}
										livePreview={mode === "live-preview"}
										codeBlockEmbeds={codeBlockEmbeds}
										resolveImageUrl={resolveNoteImageUrl}
										extraExtensions={editorExtensions}
										vimCommandProvider={vimCommandProvider}
										commandExecutor={executeEditorHotkeyCommand}
										collab={collabBinding}
										scrollMode="parent"
										onChange={handleChange}
										onCursorChange={isActive ? onCursorChange : undefined}
										onViewReady={handleViewReady}
									/>
								)}
							</div>
						</div>
					)}
				</div>
			</EditorContextMenu>
			<SlashCommandMenu
				state={
					isActive && !readOnly && mode !== "reading" && slashCommandsEnabled
						? slashCommandState
						: null
				}
			/>
			<MentionMenu state={isActive && !readOnly && mode !== "reading" ? mentionMenuState : null} />
			{showSelectionToolbar && selectionToolbarState && !slashCommandState && !mentionMenuState && (
				<SelectionToolbar
					state={selectionToolbarState}
					showFormatting={markdownToolbarEnabled}
					getEditorView={getEditorView}
					onMenuOpenChange={(open) => {
						selectionToolbarMenuOpenRef.current = open
					}}
				/>
			)}
		</>
	)
}

function openNoteTag(tag: string): void {
	openTagView(tag.toLowerCase())
}

function executeSlashCommand(commandId: string, view: EditorRuntimeView): void {
	if (commandId.startsWith(TEMPLATE_SLASH_PREFIX)) {
		const filePath = useEditorStore.getState().activeFilePath
		if (filePath) {
			void insertTemplateIntoNote(commandId.slice(TEMPLATE_SLASH_PREFIX.length), view, filePath)
		}
		return
	}
	setEditorViewRef(view as never)
	requestAnimationFrame(() => executeCommand(commandId, { source: "slash" }))
}

function executeEditorHotkeyCommand(commandId: string, view: EditorRuntimeView): boolean {
	setEditorViewRef(view as never)
	return executeCommand(commandId, { source: "hotkey" })
}

function getEditorHotkeyBindings() {
	return useHotkeysStore.getState().bindings.filter((binding) => binding.scope === "editor")
}
