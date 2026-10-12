"use dom"

import { EditorView, evictEditorDocument } from "@cortex/editor/editor-view"
import { readonlyExtension } from "@cortex/editor/extensions"
import { reconfigureMarkdownKeymap } from "@cortex/editor/keymap"
import { resolveNoteAssetPath } from "@cortex/editor/note-assets"
import { type SlashCommandMenuState, slashCommandExtension } from "@cortex/editor/slash-commands"
import type {
	CursorInfo,
	EditorConfig,
	EditorExtensionFactory,
	EditorRuntimeView,
} from "@cortex/editor/types"
import { setEditorViewRef } from "@cortex/plugin-host-core"
import {
	createFrontmatterExtension,
	updateFrontmatterEditorState,
} from "@cortex/properties/codemirror"
import { type DOMProps, useDOMImperativeHandle } from "expo/dom"
import {
	type CSSProperties,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react"

import {
	executeMobileEditorMarkdownCommand,
	getMobileEditorFormatBindings,
	mobileEditorSlashCommandItems,
	mobileEditorToolbarItems,
	registerMobileEditorCommands,
	runMobileEditorCommand,
	setMobileEditorCommandView,
} from "@/features/editor/editorCommands"
import type {
	WorkspaceCursor,
	WorkspaceDocument,
	WorkspaceOutboundMessage,
	WorkspaceViewHandle,
} from "@/features/workspace/workspaceProtocol"
import { createWorkspaceRealm } from "@/features/workspace/workspaceRealm"

import "@/features/editor/mobile-code-mirror-editor.css"

interface WorkspaceWebViewProps {
	send: (message: WorkspaceOutboundMessage) => Promise<void>
	ref?: Parameters<typeof useDOMImperativeHandle<WorkspaceViewHandle>>[0]
	dom?: DOMProps
}

interface PendingCommit {
	filePath: string
	body: string
	revision: number
}

const COMMIT_DEBOUNCE_MS = 750

const realm = createWorkspaceRealm()

function toWorkspaceCursor(cursor: CursorInfo): WorkspaceCursor {
	return { column: cursor.col, line: cursor.line, offset: cursor.offset }
}

export default function WorkspaceWebView({ send, ref }: WorkspaceWebViewProps) {
	const workspace = useSyncExternalStore(realm.subscribe, realm.getState)
	const [activeDocument, setActiveDocument] = useState<WorkspaceDocument | null>(null)
	const [slashCommandState, setSlashCommandState] = useState<SlashCommandMenuState | null>(null)
	const [assetVersion, setAssetVersion] = useState(0)
	const [commitError, setCommitError] = useState<string | null>(null)
	const [assetCache] = useState(() => new Map<string, string>())
	const [assetLoads] = useState(() => new Set<string>())
	const sendRef = useRef(send)
	const viewRef = useRef<EditorRuntimeView | null>(null)
	const documentRef = useRef<WorkspaceDocument | null>(null)
	const closedFilePathsRef = useRef(new Set<string>())
	const pendingCommitRef = useRef<PendingCommit | null>(null)
	const pendingCursorRef = useRef<WorkspaceCursor | null>(null)
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const flushPendingCommitRef = useRef<() => Promise<void>>(async () => {})
	const editorConfig = workspace?.editorConfig
	const readOnly = editorConfig?.readOnly ?? false
	const slashCommandsEnabled = editorConfig?.slashCommands ?? false
	const readOnlyRef = useRef(readOnly)
	const slashCommandsEnabledRef = useRef(slashCommandsEnabled)
	const hotkeyOverrides = workspace?.hotkeyOverrides

	const codeMirrorConfig = useMemo<EditorConfig | null>(() => {
		if (!editorConfig) return null
		const { fontSize, wordWrap, folding, tabSize, useSpaces, showLineNumbers, vimMode } =
			editorConfig
		return { fontSize, wordWrap, folding, tabSize, useSpaces, showLineNumbers, vimMode }
	}, [editorConfig])

	const [extraExtensions] = useState<EditorExtensionFactory[]>(() => [
		createFrontmatterExtension({ initialError: null, initialMeta: {} }),
		async () => (readOnlyRef.current ? await readonlyExtension() : []),
		(runtime) =>
			slashCommandExtension(runtime, {
				enabled: () => !readOnlyRef.current && slashCommandsEnabledRef.current,
				getItems: () => mobileEditorSlashCommandItems,
				itemLimit: 8,
				onExecuteCommand: (commandId, view) => {
					runMobileEditorCommand(commandId, view, "slash")
				},
				onStateChange: setSlashCommandState,
			}),
	])

	function handleChange(body: string) {
		const current = documentRef.current
		if (readOnlyRef.current || !current) return
		setCommitError(null)
		pendingCommitRef.current = { filePath: current.filePath, body, revision: current.revision }
		if (timerRef.current) clearTimeout(timerRef.current)
		timerRef.current = setTimeout(() => void flushPendingCommitRef.current(), COMMIT_DEBOUNCE_MS)
	}

	function handleCursorChange(cursor: CursorInfo) {
		pendingCursorRef.current = toWorkspaceCursor(cursor)
	}

	function executeEditorCommand(commandId: string) {
		const view = viewRef.current
		if (view && runMobileEditorCommand(commandId, view, "api")) return
		void realm.executeNativeCommand(commandId)
	}

	function resolveImageUrl(src: string, currentFilePath: string): string {
		const asset = resolveNoteAssetPath(src, currentFilePath)
		if (asset.kind === "url") return asset.value
		const cacheKey = asset.value
		const cached = assetCache.get(cacheKey)
		if (cached) return cached
		if (!assetLoads.has(cacheKey)) {
			assetLoads.add(cacheKey)
			void realm
				.resolveAssetUrl(asset.value)
				.then((url) => {
					assetCache.set(cacheKey, url)
					setAssetVersion((version) => version + 1)
				})
				.catch((error) => {
					console.error("[Mobile editor asset resolution failed]", error)
				})
				.finally(() => {
					assetLoads.delete(cacheKey)
				})
		}
		return src
	}

	function handleViewReady(view: EditorRuntimeView) {
		viewRef.current = view
		setMobileEditorCommandView(view)
		setEditorViewRef(view as never)
		const current = documentRef.current
		if (current) {
			void updateFrontmatterEditorState(view, current.frontmatterMeta, current.frontmatterError)
		}
		void reconfigureMarkdownKeymap(
			view,
			getMobileEditorFormatBindings(realm.getState()?.hotkeyOverrides ?? {}),
			executeMobileEditorMarkdownCommand,
		)
	}

	useEffect(() => {
		sendRef.current = send
	}, [send])

	useEffect(() => {
		readOnlyRef.current = readOnly
		slashCommandsEnabledRef.current = slashCommandsEnabled
	}, [readOnly, slashCommandsEnabled])

	useDOMImperativeHandle<WorkspaceViewHandle>(
		ref ?? null,
		() => ({ receive: realm.receive }) as WorkspaceViewHandle,
		[],
	)

	useEffect(() => {
		flushPendingCommitRef.current = async () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current)
				timerRef.current = null
			}
			const cursor = pendingCursorRef.current
			pendingCursorRef.current = null
			if (cursor) realm.reportCursor(cursor)
			const pendingCommit = pendingCommitRef.current
			if (!pendingCommit) return
			pendingCommitRef.current = null
			try {
				await realm.commit(pendingCommit.filePath, pendingCommit.body, pendingCommit.revision)
				setCommitError(null)
			} catch (error) {
				setCommitError(error instanceof Error ? error.message : String(error))
				console.error("[Mobile editor commit failed]", error)
			}
		}

		registerMobileEditorCommands()
		const disconnect = realm.connect(
			(message) => {
				sendRef.current(message).catch((error: unknown) => {
					console.error("[Workspace bridge send failed]", error)
				})
			},
			{
				openDocument(next) {
					const current = documentRef.current
					closedFilePathsRef.current.delete(next.filePath)
					if (current?.filePath === next.filePath && current.revision >= next.revision) {
						const unchanged = { ...next, body: current.body, revision: current.revision }
						documentRef.current = unchanged
						setActiveDocument(unchanged)
						return
					}
					if (current && current.filePath !== next.filePath) {
						void flushPendingCommitRef.current()
						setSlashCommandState(null)
					}
					documentRef.current = next
					setActiveDocument(next)
				},
				async closeDocument(filePath) {
					const view = viewRef.current
					if (documentRef.current?.filePath === filePath) {
						await flushPendingCommitRef.current()
						closedFilePathsRef.current.add(filePath)
					} else if (view) {
						evictEditorDocument(view, filePath)
					}
				},
				showEditor(visible) {
					if (visible) return
					setSlashCommandState(null)
					viewRef.current?.contentDOM.blur()
					void flushPendingCommitRef.current()
				},
				flushPendingCommit: () => flushPendingCommitRef.current(),
				getFilePath: () => documentRef.current?.filePath ?? null,
			},
		)
		const flush = () => void flushPendingCommitRef.current()
		window.addEventListener("blur", flush)
		window.addEventListener("pagehide", flush)
		return () => {
			window.removeEventListener("blur", flush)
			window.removeEventListener("pagehide", flush)
			disconnect()
			setEditorViewRef(null)
			setMobileEditorCommandView(null)
		}
	}, [])

	useEffect(() => {
		const view = viewRef.current
		if (!view || !activeDocument) return
		for (const filePath of closedFilePathsRef.current) {
			if (filePath === activeDocument.filePath) continue
			evictEditorDocument(view, filePath)
			closedFilePathsRef.current.delete(filePath)
		}
		void updateFrontmatterEditorState(
			view,
			activeDocument.frontmatterMeta,
			activeDocument.frontmatterError,
		)
	}, [activeDocument])

	useEffect(() => {
		const view = viewRef.current
		if (!view || !hotkeyOverrides) return
		void reconfigureMarkdownKeymap(
			view,
			getMobileEditorFormatBindings(hotkeyOverrides),
			executeMobileEditorMarkdownCommand,
		)
	}, [hotkeyOverrides])

	if (!workspace || !editorConfig || !codeMirrorConfig || !activeDocument) return null

	return (
		<div
			className="mobile-code-mirror-root"
			data-asset-version={assetVersion}
			data-document-revision={activeDocument.revision}
			style={workspace.themeTokens as CSSProperties}
		>
			<div className="mobile-code-mirror-toolbar">
				<span className="mobile-code-mirror-title">{activeDocument.filePath}</span>
				{mobileEditorToolbarItems.map((item) => (
					<button
						aria-label={item.label}
						className="mobile-code-mirror-action"
						disabled={editorConfig.readOnly}
						key={item.id}
						onClick={() => executeEditorCommand(item.id)}
						title={item.label}
						type="button"
					>
						{item.shortLabel}
					</button>
				))}
			</div>
			{activeDocument.frontmatterError ? (
				<div className="mobile-code-mirror-frontmatter-error">
					{activeDocument.frontmatterError}
				</div>
			) : null}
			{commitError ? <div className="mobile-code-mirror-commit-error">{commitError}</div> : null}
			<div className="mobile-code-mirror-shell">
				<EditorView
					commandExecutor={executeMobileEditorMarkdownCommand}
					content={activeDocument.body}
					documentKey={activeDocument.filePath}
					editorConfig={codeMirrorConfig}
					extraExtensions={extraExtensions}
					filePath={activeDocument.filePath}
					livePreview={editorConfig.livePreview}
					onChange={handleChange}
					onCursorChange={handleCursorChange}
					onViewReady={handleViewReady}
					resolveImageUrl={resolveImageUrl}
					scrollMode="internal"
				/>
				{slashCommandState && editorConfig.slashCommands ? (
					<div
						className="mobile-code-mirror-slash-menu"
						style={{
							left: slashCommandState.position.left,
							top: slashCommandState.position.top,
						}}
					>
						{slashCommandState.items.map((item, index) => (
							<button
								className="mobile-code-mirror-slash-item"
								data-selected={index === slashCommandState.selectedIndex || undefined}
								key={item.id}
								onClick={() => {
									slashCommandState.execute(item.id)
								}}
								onPointerEnter={() => slashCommandState.select(index)}
								type="button"
							>
								<span>{item.label}</span>
								<span>{item.category}</span>
							</button>
						))}
					</div>
				) : null}
			</div>
		</div>
	)
}
