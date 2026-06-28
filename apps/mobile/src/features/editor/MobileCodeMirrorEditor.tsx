"use dom"

import { EditorView } from "@cortex/editor/editor-view"
import { DEFAULT_EDITOR_CONFIG, readonlyExtension } from "@cortex/editor/extensions"
import { reconfigureMarkdownKeymap } from "@cortex/editor/keymap"
import { slashCommandExtension, type SlashCommandMenuState } from "@cortex/editor/slash-commands"
import type {
	CursorInfo,
	EditorConfig,
	EditorExtensionFactory,
	EditorRuntimeView,
} from "@cortex/editor/types"
import {
	createFrontmatterExtension,
	updateFrontmatterEditorState,
} from "@cortex/properties/codemirror"
import { type CSSProperties, useEffect, useRef, useState } from "react"

import {
	executeMobileEditorMarkdownCommand,
	mobileEditorFormatBindings,
	mobileEditorSlashCommandItems,
	registerMobileEditorCommands,
	runMobileEditorCommand,
	setMobileEditorCommandView,
} from "@/features/editor/mobile-editor-commands"
import type {
	MobileCodeMirrorEditorProps,
	MobileEditorCursor,
} from "@/features/editor/mobile-editor-contract"
import {
	initializeMobileEditorPluginHost,
	setMobileEditorPluginView,
} from "@/features/editor/mobile-editor-plugin-host"

import "./mobile-code-mirror-editor.css"

interface PendingCommit {
	body: string
	commitBody: MobileCodeMirrorEditorProps["commitBody"]
	revision: number
}

interface ToolbarAction {
	id: string
	label: string
	title: string
}

const COMMIT_DEBOUNCE_MS = 750

const toolbarActions: ToolbarAction[] = [
	{ id: "format.bold", label: "B", title: "Bold" },
	{ id: "format.italic", label: "I", title: "Italic" },
	{ id: "format.heading-1", label: "H1", title: "Heading 1" },
	{ id: "format.heading-2", label: "H2", title: "Heading 2" },
	{ id: "format.link", label: "Link", title: "Link" },
	{ id: "format.unordered-list", label: "List", title: "List" },
	{ id: "format.task-list", label: "Task", title: "Task" },
	{ id: "format.table", label: "Table", title: "Table" },
]

function createCodeMirrorConfig(editorConfig: MobileCodeMirrorEditorProps["editorConfig"]) {
	return {
		...DEFAULT_EDITOR_CONFIG,
		...editorConfig.editorOverrides,
	} satisfies EditorConfig
}

function createThemeStyle(themeTokens: Record<string, string>): CSSProperties {
	return {
		"--accent-color": themeTokens.accent ?? "#0a84ff",
		"--editor-background": themeTokens.background ?? "#ffffff",
		"--editor-caret-color": themeTokens.accent ?? "#0a84ff",
		"--editor-font-family":
			themeTokens.editorFontFamily ??
			'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
		"--editor-font-size": themeTokens.editorFontSize ?? "16px",
		"--editor-foreground": themeTokens.foreground ?? "#111111",
		"--editor-line-height": themeTokens.editorLineHeight ?? "1.55",
		"--editor-muted-foreground": themeTokens.mutedForeground ?? "rgba(127, 127, 127, 0.78)",
		"--editor-search-match-active-bg":
			themeTokens.searchMatchActiveBackground ?? "rgba(255, 214, 10, 0.42)",
		"--editor-search-match-bg": themeTokens.searchMatchBackground ?? "rgba(255, 214, 10, 0.24)",
		"--editor-selection-bg": themeTokens.selectionBackground ?? "rgba(10, 132, 255, 0.28)",
		"--editor-separator": themeTokens.separator ?? "rgba(127, 127, 127, 0.28)",
		"--editor-toolbar-active-bg": themeTokens.toolbarActiveBackground ?? "rgba(127, 127, 127, 0.16)",
		"--editor-warning-background": themeTokens.warningBackground ?? "rgba(255, 149, 0, 0.18)",
		"--editor-warning-foreground": themeTokens.warningForeground ?? "inherit",
		"--font-editor":
			themeTokens.editorFontFamily ??
			'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
		"--font-ui":
			themeTokens.uiFontFamily ?? '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
		"--ui-font-family":
			themeTokens.uiFontFamily ?? '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
		"--ui-font-size": themeTokens.uiFontSize ?? "14px",
	} as CSSProperties
}

function isResolvedAssetUrl(src: string): boolean {
	return /^(asset|content|data|file|https?):/u.test(src)
}

function toMobileCursor(cursor: CursorInfo): MobileEditorCursor {
	return {
		column: cursor.col,
		line: cursor.line,
		offset: cursor.offset,
	}
}

export default function MobileCodeMirrorEditor({
	filePath,
	body,
	documentRevision,
	editorConfig,
	frontmatterMeta,
	frontmatterError,
	themeTokens,
	commitBody,
	reportCursor,
	executeCommand,
	resolveAssetUrl,
}: MobileCodeMirrorEditorProps) {
	const [slashCommandState, setSlashCommandState] = useState<SlashCommandMenuState | null>(null)
	const [assetVersion, setAssetVersion] = useState(0)
	const [commitError, setCommitError] = useState<string | null>(null)
	const [assetCache] = useState(() => new Map<string, string>())
	const [assetLoads] = useState(() => new Set<string>())
	const bodyRef = useRef(body)
	const commitBodyRef = useRef(commitBody)
	const currentRevisionRef = useRef(documentRevision)
	const filePathRef = useRef(filePath)
	const flushPendingCommitRef = useRef<() => Promise<void>>(async () => {})
	const mountedRef = useRef(true)
	const pendingCommitRef = useRef<PendingCommit | null>(null)
	const reportCursorRef = useRef(reportCursor)
	const cursorFrameRef = useRef<number | null>(null)
	const pendingCursorRef = useRef<MobileEditorCursor | null>(null)
	const previousFilePathRef = useRef(filePath)
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const viewRef = useRef<EditorRuntimeView | null>(null)

	const codeMirrorConfig = createCodeMirrorConfig(editorConfig)
	const rootStyle = createThemeStyle(themeTokens)

	function scheduleCommit(nextBody: string) {
		if (editorConfig.readOnly) return
		setCommitError(null)
		pendingCommitRef.current = {
			body: nextBody,
			commitBody: commitBodyRef.current,
			revision: currentRevisionRef.current,
		}
		if (timerRef.current) clearTimeout(timerRef.current)
		timerRef.current = setTimeout(() => {
			void flushPendingCommitRef.current().catch((error) => {
				const message = error instanceof Error ? error.message : String(error)
				setCommitError(message)
				console.error("[Mobile editor commit failed]", error)
			})
		}, COMMIT_DEBOUNCE_MS)
	}

	function handleChange(nextBody: string) {
		bodyRef.current = nextBody
		scheduleCommit(nextBody)
	}

	function handleCursorChange(cursor: CursorInfo) {
		pendingCursorRef.current = toMobileCursor(cursor)
		if (cursorFrameRef.current !== null) return
		cursorFrameRef.current = requestAnimationFrame(() => {
			cursorFrameRef.current = null
			if (!mountedRef.current) return
			const pendingCursor = pendingCursorRef.current
			if (!pendingCursor) return
			pendingCursorRef.current = null
			void reportCursorRef.current(pendingCursor)
		})
	}

	function executeEditorCommand(commandId: string) {
		const view = viewRef.current
		if (!view) {
			void executeCommand(commandId, "mobile-dom-toolbar")
			return
		}
		const executed = runMobileEditorCommand(commandId, view, "api")
		if (!executed) void executeCommand(commandId, "mobile-dom-toolbar")
	}

	function resolveImageUrl(src: string, currentFilePath: string): string {
		if (isResolvedAssetUrl(src)) return src
		const cacheKey = `${currentFilePath}\n${src}`
		const cached = assetCache.get(cacheKey)
		if (cached) return cached
		if (!assetLoads.has(cacheKey)) {
			assetLoads.add(cacheKey)
			void resolveAssetUrl(src, currentFilePath)
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

	const extraExtensions: EditorExtensionFactory[] = [
		createFrontmatterExtension({
			initialError: frontmatterError,
			initialMeta: frontmatterMeta,
		}),
		async () => (editorConfig.readOnly ? await readonlyExtension() : []),
		(runtime) =>
			slashCommandExtension(runtime, {
				enabled: () => !editorConfig.readOnly,
				getItems: () => mobileEditorSlashCommandItems,
				itemLimit: 8,
				onExecuteCommand: (commandId, view) => {
					runMobileEditorCommand(commandId, view, "slash")
				},
				onStateChange: setSlashCommandState,
			}),
	]

	function handleViewReady(view: EditorRuntimeView) {
		viewRef.current = view
		setMobileEditorCommandView(view)
		setMobileEditorPluginView(view)
		void updateFrontmatterEditorState(view, frontmatterMeta, frontmatterError)
		void reconfigureMarkdownKeymap(
			view,
			mobileEditorFormatBindings,
			executeMobileEditorMarkdownCommand,
		)
	}

	useEffect(() => {
		commitBodyRef.current = commitBody
	}, [commitBody])

	useEffect(() => {
		reportCursorRef.current = reportCursor
	}, [reportCursor])

	useEffect(() => {
		bodyRef.current = body
		currentRevisionRef.current = documentRevision
		filePathRef.current = filePath
	}, [body, documentRevision, filePath])

	useEffect(() => {
		flushPendingCommitRef.current = async () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current)
				timerRef.current = null
			}
			const pendingCommit = pendingCommitRef.current
			if (!pendingCommit || editorConfig.readOnly) return
			pendingCommitRef.current = null
			await pendingCommit.commitBody(pendingCommit.body, pendingCommit.revision)
			setCommitError(null)
		}
	}, [editorConfig.readOnly])

	useEffect(() => {
		if (previousFilePathRef.current === filePath) return
		previousFilePathRef.current = filePath
		setSlashCommandState(null)
		void flushPendingCommitRef.current().catch((error) => {
			const message = error instanceof Error ? error.message : String(error)
			setCommitError(message)
			console.error("[Mobile editor commit failed]", error)
		})
	}, [filePath])

	useEffect(() => {
		mountedRef.current = true
		registerMobileEditorCommands()
		initializeMobileEditorPluginHost({
			getActiveFileContent: () => bodyRef.current,
			getActiveFilePath: () => filePathRef.current,
			getVaultPath: () => null,
		})
		return () => {
			setMobileEditorPluginView(null)
			setMobileEditorCommandView(null)
			mountedRef.current = false
		}
	}, [])

	useEffect(() => {
		const view = viewRef.current
		if (!view) return
		void updateFrontmatterEditorState(view, frontmatterMeta, frontmatterError)
	}, [frontmatterError, frontmatterMeta])

	useEffect(() => {
		const flush = () => {
			void flushPendingCommitRef.current().catch((error) => {
				const message = error instanceof Error ? error.message : String(error)
				setCommitError(message)
				console.error("[Mobile editor commit failed]", error)
			})
		}
		window.addEventListener("blur", flush)
		window.addEventListener("pagehide", flush)
		return () => {
			window.removeEventListener("blur", flush)
			window.removeEventListener("pagehide", flush)
			flush()
		}
	}, [])

	return (
		<div
			className="mobile-code-mirror-root"
			data-asset-version={assetVersion}
			data-document-revision={documentRevision}
			style={rootStyle}
		>
			<div className="mobile-code-mirror-toolbar">
				<span className="mobile-code-mirror-title">{filePath}</span>
				{toolbarActions.map((action) => (
					<button
						className="mobile-code-mirror-action"
						disabled={editorConfig.readOnly}
						key={action.id}
						onClick={() => executeEditorCommand(action.id)}
						title={action.title}
						type="button"
					>
						{action.label}
					</button>
				))}
			</div>
			{frontmatterError ? (
				<div className="mobile-code-mirror-frontmatter-error">{frontmatterError}</div>
			) : null}
			{commitError ? <div className="mobile-code-mirror-commit-error">{commitError}</div> : null}
			<div className="mobile-code-mirror-shell">
				<EditorView
					commandExecutor={executeMobileEditorMarkdownCommand}
					content={body}
					editorConfig={codeMirrorConfig}
					extraExtensions={extraExtensions}
					filePath={filePath}
					livePreview={editorConfig.livePreview}
					onChange={handleChange}
					onCursorChange={handleCursorChange}
					onViewReady={handleViewReady}
					resolveImageUrl={resolveImageUrl}
					scrollMode="internal"
				/>
				{slashCommandState ? (
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
