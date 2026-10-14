"use dom"

import { EditorView, evictEditorDocument } from "@cortex/editor/editor-view"
import { readonlyExtension } from "@cortex/editor/extensions"
import { reconfigureMarkdownKeymap } from "@cortex/editor/keymap"
import { resolveNoteAssetPath } from "@cortex/editor/note-assets"
import {
	searchHighlightExtension,
	setSearchHighlight,
	stepSearchHighlight,
} from "@cortex/editor/search-commands"
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

import { MOBILE_CODE_BLOCK_EMBEDS } from "@/features/editor/embeds/mobileCodeBlockEmbeds"
import {
	executeMobileEditorMarkdownCommand,
	getMobileEditorFormatBindings,
	mobileEditorSlashCommandItems,
	registerMobileEditorCommands,
	runMobileEditorCommand,
	setMobileEditorCommandView,
} from "@/features/editor/editorCommands"
import type {
	WorkspaceCursor,
	WorkspaceDocument,
	WorkspaceFindResult,
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
const SCROLL_MARGIN = 16
const DRAG_DISMISS_DISTANCE = 10
const MOBILE_BLUR_COMMAND = "mobile.blur"
const MOBILE_FOCUS_COMMAND = "mobile.focus"
const MOBILE_REVEAL_LINE_COMMAND = "mobile.reveal-line"
const MOBILE_SLASH_COMMAND = "mobile.slash"
const MOBILE_INSERT_DIVIDER_COMMAND = "mobile.insert-divider"
const MOBILE_INSERT_TAG_COMMAND = "mobile.insert-tag"
const MOBILE_INSERT_WIKILINK_COMMAND = "mobile.insert-wikilink"

const realm = createWorkspaceRealm()

function insertAtSelection(view: EditorRuntimeView, before: string, after = ""): void {
	const range = view.state.selection.main
	const selected = view.state.sliceDoc(range.from, range.to)
	view.focus()
	view.dispatch({
		changes: { from: range.from, to: range.to, insert: `${before}${selected}${after}` },
		selection: { anchor: range.from + before.length + selected.length },
		scrollIntoView: true,
	})
}

function insertDivider(view: EditorRuntimeView): void {
	const range = view.state.selection.main
	const line = view.state.doc.lineAt(range.from)
	const prefix = line.text.trim().length > 0 ? "\n\n" : ""
	view.focus()
	view.dispatch({
		changes: { from: line.to, insert: `${prefix}---\n` },
		selection: { anchor: line.to + prefix.length + 4 },
		scrollIntoView: true,
	})
}

function revealLine(view: EditorRuntimeView, line: number): void {
	const lineNumber = Math.min(Math.max(line + 1, 1), view.state.doc.lines)
	const position = view.state.doc.line(lineNumber).from
	view.dispatch({
		selection: { anchor: position },
		effects: [],
		scrollIntoView: true,
	})
}

/** Blurs the editor when the user drags the scroller, like `keyboardDismissMode="on-drag"`. */
function dismissKeyboardOnDrag(getView: () => EditorRuntimeView | null): () => void {
	let touching = false
	let startScrollTop = 0
	const onTouchStart = () => {
		touching = true
		startScrollTop = getView()?.scrollDOM.scrollTop ?? 0
	}
	const onTouchEnd = () => {
		touching = false
	}
	const onScroll = (event: Event) => {
		const view = getView()
		if (!touching || !view || event.target !== view.scrollDOM || !view.hasFocus) return
		if (Math.abs(view.scrollDOM.scrollTop - startScrollTop) < DRAG_DISMISS_DISTANCE) return
		view.contentDOM.blur()
	}
	const passive = { capture: true, passive: true }
	document.addEventListener("touchstart", onTouchStart, passive)
	document.addEventListener("touchend", onTouchEnd, passive)
	document.addEventListener("touchcancel", onTouchEnd, passive)
	document.addEventListener("scroll", onScroll, passive)
	return () => {
		document.removeEventListener("touchstart", onTouchStart, passive)
		document.removeEventListener("touchend", onTouchEnd, passive)
		document.removeEventListener("touchcancel", onTouchEnd, passive)
		document.removeEventListener("scroll", onScroll, passive)
	}
}

/** Keeps the editor root inside the visual viewport if WebKit shrinks or scrolls it. */
function syncVisualViewport(): () => void {
	const viewport = window.visualViewport
	if (!viewport) return () => {}
	const root = document.documentElement.style
	const sync = () => {
		root.setProperty("--mobile-viewport-height", `${viewport.height}px`)
		root.setProperty("--mobile-viewport-top", `${viewport.offsetTop}px`)
	}
	sync()
	viewport.addEventListener("resize", sync)
	viewport.addEventListener("scroll", sync)
	return () => {
		viewport.removeEventListener("resize", sync)
		viewport.removeEventListener("scroll", sync)
	}
}

function toWorkspaceCursor(cursor: CursorInfo): WorkspaceCursor {
	return { column: cursor.col, line: cursor.line, offset: cursor.offset }
}

export default function WorkspaceWebView({ send, ref }: WorkspaceWebViewProps) {
	const workspace = useSyncExternalStore(realm.subscribe, realm.getState)
	const [activeDocument, setActiveDocument] = useState<WorkspaceDocument | null>(null)
	const [slashCommandState, setSlashCommandState] = useState<SlashCommandMenuState | null>(null)
	const [assetVersion, setAssetVersion] = useState(0)
	const [commitError, setCommitError] = useState<string | null>(null)
	const [bottomInset, setBottomInset] = useState(0)
	const bottomInsetRef = useRef(0)
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
		(runtime) =>
			runtime.view.EditorView.scrollMargins.of(() => ({
				bottom: bottomInsetRef.current + SCROLL_MARGIN,
				top: SCROLL_MARGIN,
			})),
		(runtime) => searchHighlightExtension(runtime),
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
				setBottomInset(value) {
					bottomInsetRef.current = value
					setBottomInset(value)
				},
				flushPendingCommit: () => flushPendingCommitRef.current(),
				getFilePath: () => documentRef.current?.filePath ?? null,
				runCommand(commandId, payload) {
					const view = viewRef.current
					if (!view) return
					switch (commandId) {
						case MOBILE_BLUR_COMMAND:
							view.contentDOM.blur()
							return
						case MOBILE_FOCUS_COMMAND:
							view.focus()
							return
						case MOBILE_SLASH_COMMAND:
							view.focus()
							view.dispatch(view.state.replaceSelection("/"))
							return
						case MOBILE_REVEAL_LINE_COMMAND:
							if (typeof payload === "number") revealLine(view, payload)
							return
						case MOBILE_INSERT_DIVIDER_COMMAND:
							insertDivider(view)
							return
						case MOBILE_INSERT_TAG_COMMAND:
							insertAtSelection(view, "#")
							return
						case MOBILE_INSERT_WIKILINK_COMMAND:
							insertAtSelection(view, "[[", "]]")
							return
						default:
							runMobileEditorCommand(commandId, view, "api")
					}
				},
				async find(query, direction): Promise<WorkspaceFindResult> {
					const view = viewRef.current
					if (!view) return { current: 0, total: 0 }
					const state = direction
						? await stepSearchHighlight(view, direction === "next" ? 1 : -1)
						: await setSearchHighlight(view, query || null)
					return { current: state.total === 0 ? 0 : state.index + 1, total: state.total }
				},
			},
		)
		const flush = () => void flushPendingCommitRef.current()
		const stopDragDismiss = dismissKeyboardOnDrag(() => viewRef.current)
		const stopViewportSync = syncVisualViewport()
		window.addEventListener("blur", flush)
		window.addEventListener("pagehide", flush)
		return () => {
			stopDragDismiss()
			stopViewportSync()
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
			style={
				{
					...workspace.themeTokens,
					"--mobile-editor-bottom-inset": `${bottomInset}px`,
				} as CSSProperties
			}
		>
			{activeDocument.frontmatterError ? (
				<div className="mobile-code-mirror-frontmatter-error">
					{activeDocument.frontmatterError}
				</div>
			) : null}
			{commitError ? <div className="mobile-code-mirror-commit-error">{commitError}</div> : null}
			<div className="mobile-code-mirror-shell">
				<EditorView
					codeBlockEmbeds={MOBILE_CODE_BLOCK_EMBEDS}
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
