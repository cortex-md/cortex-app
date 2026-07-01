import { executeCommand } from "@cortex/commands"
import type { Tab } from "@cortex/core"
import { noteCache, useEditorStore, useVaultStore, useWorkspaceStore } from "@cortex/core"
import { clipboardImageExtension } from "@cortex/editor/clipboard"
import type { CodeBlockEmbedDefinition } from "@cortex/editor/code-block-embeds"
import { EditorView } from "@cortex/editor/editor-view"
import { reconfigureMarkdownKeymap } from "@cortex/editor/keymap"
import type { LineEmbedDefinition } from "@cortex/editor/line-embeds"
import { ReadingView } from "@cortex/editor/reading-view"
import { SideBySideView } from "@cortex/editor/side-by-side-view"
import { type SlashCommandMenuState, slashCommandExtension } from "@cortex/editor/slash-commands"
import type {
	CursorInfo,
	EditorConfig,
	EditorExtensionFactory,
	EditorRuntimeView,
} from "@cortex/editor/types"
import { useHotkeysStore } from "@cortex/hotkeys"
import { getPlatform } from "@cortex/platform"
import { setEditorViewRef } from "@cortex/plugin-host-core"
import {
	type PropertyMap,
	projectRawNote,
	type RawNoteProjection,
	replaceFrontmatterBody,
} from "@cortex/properties"
import {
	createFrontmatterExtension,
	updateFrontmatterEditorState,
} from "@cortex/properties/codemirror"
import { useSettingsStore } from "@cortex/settings"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createDatabaseLineEmbeds } from "../databases/databaseLineEmbeds"
import { DrawingEmbedCard } from "../drawings/DrawingEmbedCard"
import { mountDrawingLivePreview } from "../drawings/DrawingLivePreview"
import { DRAWING_FENCE_LANGUAGE, parseDrawingDocument } from "../drawings/drawingDocument"
import { openDrawingModal } from "../drawings/drawingModalStore"
import { createMermaidCodeBlockEmbed } from "../mermaid/mermaidCodeBlockEmbed"
import { NotePropertiesPanel } from "../properties/NotePropertiesPanel"
import { EditorContextMenu } from "./EditorContextMenu"
import { MarkdownToolbar } from "./MarkdownToolbar"
import { getSlashCommandItems } from "./markdownFormatActions"
import { NoteHeader } from "./NoteHeader"
import { SlashCommandMenu } from "./SlashCommandMenu"
import { cortexVimCommandProvider } from "./vimCommandProvider"

export interface TabEditorProps {
	tab: Tab
	paneId: string
	isActive: boolean
	editorConfig: EditorConfig
	onCursorChange: (cursor: CursorInfo) => void
	onViewHistory: (filePath: string) => void
}

interface ProjectedContentDraft {
	filePath: string
	projection: RawNoteProjection
}

function createNoteCodeBlockEmbeds(filePath: string): CodeBlockEmbedDefinition[] {
	return [
		{
			languages: [DRAWING_FENCE_LANGUAGE],
			render: ({ block }) => <DrawingEmbedCard filePath={filePath} block={block} />,
			renderLivePreview: ({ content }) => {
				const document = parseDrawingDocument(content)
				if (!document) {
					return {
						title: "Drawing unavailable",
						description: "The embedded drawing data could not be read.",
						icon: "!",
						tone: "error",
					}
				}
				return {
					title: document.title,
					className: "is-drawing-board",
					mount: (container) =>
						mountDrawingLivePreview(container, {
							filePath,
							drawingId: document.id,
						}),
				}
			},
			canOpenLivePreview: ({ content }) => parseDrawingDocument(content) !== null,
			openLivePreview: ({ content }) => {
				const document = parseDrawingDocument(content)
				if (!document) return
				openDrawingModal({ filePath, drawingId: document.id })
			},
			livePreviewOpenLabel: "Open",
		},
		createMermaidCodeBlockEmbed(filePath),
	]
}

export function ActiveTabEditor({
	tab,
	paneId,
	isActive,
	editorConfig,
	onCursorChange,
	onViewHistory,
}: TabEditorProps) {
	const [projectedContentDraft, setProjectedContentDraft] = useState<ProjectedContentDraft | null>(
		() => getCachedProjectedContent(tab.filePath),
	)
	const markTabDirty = useWorkspaceStore((s) => s.markTabDirty)
	const mode = useEditorStore((s) => s.mode)
	const viewRef = useRef<EditorRuntimeView | null>(null)
	const rawContentRef = useRef<string | null>(null)
	const [slashCommandState, setSlashCommandState] = useState<SlashCommandMenuState | null>(null)
	const frontmatterStateRef = useRef<{ meta: PropertyMap; error: string | null }>({
		meta: {},
		error: null,
	})
	const getEditorView = useCallback(() => viewRef.current as EditorRuntimeView | null, [])
	const vimCommandProvider = editorConfig.vimMode ? cortexVimCommandProvider : null
	const slashCommandsEnabled = useSettingsStore((s) => s.settings.editor.slashCommands)
	const markdownToolbarEnabled = useSettingsStore((s) => s.settings.editor.markdownToolbar)
	const showMarkdownToolbar =
		isActive &&
		markdownToolbarEnabled &&
		(mode === "source" || mode === "live-preview" || mode === "side-by-side")
	const projectedContent =
		projectedContentDraft?.filePath === tab.filePath
			? projectedContentDraft.projection
			: (getCachedProjectedContent(tab.filePath)?.projection ?? null)
	const codeBlockEmbeds = useMemo(() => createNoteCodeBlockEmbeds(tab.filePath), [tab.filePath])
	const lineEmbeds = useMemo<LineEmbedDefinition[]>(
		() => createDatabaseLineEmbeds(tab.filePath),
		[tab.filePath],
	)

	const formatBindingsSnapshot = useHotkeysStore((s) =>
		s.bindings
			.flatMap((binding) =>
				binding.scope === "editor" ? [`${binding.id}=${binding.keys}:${binding.enabled}`] : [],
			)
			.join(","),
	)

	const handleImagePaste = useCallback(
		async (imageBlob: Blob): Promise<string | null> => {
			const vaultPath = useVaultStore.getState().vault?.path
			if (!vaultPath) return null

			const editorSettings = useSettingsStore.getState().settings.editor
			const fileDir = tab.filePath.substring(0, tab.filePath.lastIndexOf("/"))

			let targetDir: string
			if (editorSettings.imageStorageLocation === "root") {
				targetDir = vaultPath
			} else if (editorSettings.imageStorageLocation === "custom") {
				const customPath = editorSettings.imageStorageCustomPath
				targetDir = customPath ? `${vaultPath}/${customPath}` : vaultPath
			} else {
				targetDir = fileDir
			}

			const extension = extensionFromMimeType(imageBlob.type)
			const fileName = `paste-${Date.now()}${extension}`
			const targetPath = `${targetDir}/${fileName}`

			const arrayBuffer = await imageBlob.arrayBuffer()
			const data = Array.from(new Uint8Array(arrayBuffer))

			await getPlatform().fs.writeBinaryFile(targetPath, data)

			const relativePath = computeRelativePath(fileDir, targetPath)
			return `![${fileName}](${relativePath})`
		},
		[tab.filePath],
	)

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
		],
		[handleImagePaste, handleSlashCommandStateChange],
	)

	useEffect(() => {
		if (!slashCommandsEnabled) setSlashCommandState(null)
	}, [slashCommandsEnabled])

	const resolveImageUrl = useCallback((src: string, currentFilePath: string): string => {
		if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
			return src
		}
		const fileDir = currentFilePath.substring(0, currentFilePath.lastIndexOf("/"))
		const absolutePath = src.startsWith("/") ? src : `${fileDir}/${src}`
		return getPlatform().app.resolveFileAssetUrl(absolutePath)
	}, [])

	const updateProjectedFrontmatter = useCallback((projection: RawNoteProjection) => {
		frontmatterStateRef.current = {
			meta: projection.meta,
			error: projection.frontmatterError,
		}
		const view = viewRef.current as EditorRuntimeView | null
		if (view) {
			void updateFrontmatterEditorState(
				view,
				frontmatterStateRef.current.meta,
				frontmatterStateRef.current.error,
			)
		}
	}, [])

	useEffect(() => {
		let active = true
		const applyProjectedContent = (projection: RawNoteProjection) => {
			if (!active) return
			rawContentRef.current = projection.rawContent
			setProjectedContentDraft({ filePath: tab.filePath, projection })
			updateProjectedFrontmatter(projection)
		}
		const cachedContent = getCachedProjectedContent(tab.filePath)
		if (cachedContent) {
			applyProjectedContent(cachedContent.projection)
		} else {
			rawContentRef.current = null
			noteCache
				.readEntry(tab.filePath)
				.then((entry) => applyProjectedContent(projectRawNote(entry.content)))
				.catch(() => {
					if (!active) return
					rawContentRef.current = null
					setProjectedContentDraft(null)
				})
		}
		return () => {
			active = false
		}
	}, [tab.filePath, updateProjectedFrontmatter])

	useEffect(() => {
		const unsubscribe = noteCache.onContentChange(tab.filePath, (_filePath, newContent) => {
			const projection = projectRawNote(newContent)
			rawContentRef.current = projection.rawContent
			setProjectedContentDraft({ filePath: tab.filePath, projection })
			updateProjectedFrontmatter(projection)
		})
		return unsubscribe
	}, [tab.filePath, updateProjectedFrontmatter])

	const handleChange = useCallback(
		(newBody: string) => {
			const currentRawContent = rawContentRef.current ?? ""
			const nextRawContent = replaceFrontmatterBody(currentRawContent, newBody)
			const nextProjection = projectRawNote(nextRawContent)
			rawContentRef.current = nextProjection.rawContent
			setProjectedContentDraft({ filePath: tab.filePath, projection: nextProjection })
			noteCache.write(tab.filePath, nextRawContent)
			markTabDirty(tab.id, true)
		},
		[tab.filePath, tab.id, markTabDirty],
	)

	const handleExternalLinkClick = useCallback((url: string) => {
		void getPlatform().app.openExternalUrl(url)
	}, [])

	const handleViewReady = useCallback(
		(view: EditorRuntimeView) => {
			viewRef.current = view
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
		[isActive],
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
					{projectedContent === null ? (
						<div className="flex-1 bg-bg-primary" />
					) : (
						<div className="note-document-scroll">
							<NoteHeader filePath={tab.filePath} paneId={paneId} onViewHistory={onViewHistory} />
							<NotePropertiesPanel
								filePath={tab.filePath}
								rawContent={projectedContent.rawContent}
								projection={projectedContent}
							/>
							{showMarkdownToolbar && <MarkdownToolbar getEditorView={getEditorView} />}
							<div className="note-document-surface">
								{mode === "reading" ? (
									<ReadingView
										content={projectedContent.body}
										scrollMode="parent"
										codeBlockEmbeds={codeBlockEmbeds}
										lineEmbeds={lineEmbeds}
										onExternalLinkClick={handleExternalLinkClick}
									/>
								) : mode === "side-by-side" ? (
									<SideBySideView
										content={projectedContent.body}
										filePath={tab.filePath}
										editorConfig={editorConfig}
										extraExtensions={editorExtensions}
										codeBlockEmbeds={codeBlockEmbeds}
										lineEmbeds={lineEmbeds}
										resolveImageUrl={resolveImageUrl}
										vimCommandProvider={vimCommandProvider}
										commandExecutor={executeEditorHotkeyCommand}
										scrollMode="parent"
										onChange={handleChange}
										onViewReady={handleViewReady}
										onExternalLinkClick={handleExternalLinkClick}
									/>
								) : (
									<EditorView
										content={projectedContent.body}
										filePath={tab.filePath}
										editorConfig={editorConfig}
										livePreview={mode === "live-preview"}
										codeBlockEmbeds={codeBlockEmbeds}
										lineEmbeds={lineEmbeds}
										resolveImageUrl={resolveImageUrl}
										extraExtensions={editorExtensions}
										vimCommandProvider={vimCommandProvider}
										commandExecutor={executeEditorHotkeyCommand}
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
				state={isActive && mode !== "reading" && slashCommandsEnabled ? slashCommandState : null}
			/>
		</>
	)
}

function createProjectedContentDraft(filePath: string, rawContent: string): ProjectedContentDraft {
	return {
		filePath,
		projection: projectRawNote(rawContent),
	}
}

function getCachedProjectedContent(filePath: string): ProjectedContentDraft | null {
	const entry = noteCache.getEntry(filePath)
	return entry ? createProjectedContentDraft(filePath, entry.content) : null
}

function computeRelativePath(fromDir: string, toFile: string): string {
	const fromParts = fromDir.split("/").filter(Boolean)
	const toParts = toFile.split("/").filter(Boolean)
	let common = 0
	while (
		common < fromParts.length &&
		common < toParts.length &&
		fromParts[common] === toParts[common]
	) {
		common++
	}
	const ups = fromParts.length - common
	const remaining = toParts.slice(common)
	const relative = [...Array(ups).fill(".."), ...remaining].join("/")
	return relative.startsWith(".") ? relative : `./${relative}`
}

function extensionFromMimeType(mimeType: string): string {
	if (mimeType === "image/jpeg") return ".jpg"
	if (mimeType === "image/webp") return ".webp"
	if (mimeType === "image/gif") return ".gif"
	return ".png"
}

function executeSlashCommand(commandId: string, view: EditorRuntimeView): void {
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
