import "./markdown.css"
import { useEffect, useRef, useState } from "react"
import type { CodeBlockEmbedDefinition } from "./codeBlockEmbeds"
import {
	attachCollabBinding,
	type CollabEditorBinding,
	isExternalEditorTransaction,
} from "./collab"
import {
	type BaseExtensionsOptions,
	baseExtensions,
	copyEditorCompartments,
	DEFAULT_EDITOR_CONFIG,
	detachCollabCompartmentEffects,
	reconfigureEditor,
} from "./extensions"
import type { MarkdownCommandExecutor } from "./markdownKeymap"
import { loadEditorRuntime, loadVimRuntime } from "./runtime"
import type {
	CursorInfo,
	EditorConfig,
	EditorExtensionFactory,
	EditorRuntimeExtension,
	EditorRuntimeModules,
	EditorRuntimeState,
	EditorRuntimeStateEffect,
	EditorRuntimeView,
	EditorRuntimeViewUpdate,
	EditorScrollMode,
	VimCommandProvider,
} from "./types"

interface Props {
	content: string
	filePath: string
	documentKey?: string
	editorConfig?: EditorConfig
	livePreview?: boolean
	codeBlockEmbeds?: readonly CodeBlockEmbedDefinition[]
	resolveImageUrl?: (src: string, filePath: string) => string
	extraExtensions?: EditorExtensionFactory[]
	scrollMode?: EditorScrollMode
	vimCommandProvider?: VimCommandProvider | null
	commandExecutor?: MarkdownCommandExecutor | null
	collab?: CollabEditorBinding | null
	onChange: (content: string) => void
	onCursorChange?: (cursor: CursorInfo) => void
	onViewReady?: (view: EditorRuntimeView) => void
}

const MAX_CACHED_DOCUMENTS = 5

interface CachedDocument {
	state: EditorRuntimeState
	scroll: EditorRuntimeStateEffect
}

const documentCaches = new WeakMap<EditorRuntimeView, Map<string, CachedDocument>>()

export function evictEditorDocument(view: EditorRuntimeView, documentKey: string): void {
	documentCaches.get(view)?.delete(documentKey)
}

function swapDocument(
	runtime: EditorRuntimeModules,
	view: EditorRuntimeView,
	extensions: EditorRuntimeExtension[],
	previousKey: string | undefined,
	nextKey: string,
	content: string,
): void {
	let cache = documentCaches.get(view)
	if (!cache) {
		cache = new Map()
		documentCaches.set(view, cache)
	}
	if (previousKey !== undefined) {
		cache.delete(previousKey)
		cache.set(previousKey, { state: view.state, scroll: view.scrollSnapshot() })
		if (cache.size > MAX_CACHED_DOCUMENTS) {
			const oldest = cache.keys().next().value
			if (oldest !== undefined) cache.delete(oldest)
		}
	}
	const cached = cache.get(nextKey)
	cache.delete(nextKey)
	const restored = cached?.state.doc.toString() === content ? cached : undefined
	const nextState =
		restored?.state ?? runtime.state.EditorState.create({ doc: content, extensions })
	view.setState(
		nextState.update({
			effects: [
				...copyEditorCompartments(runtime, view.state),
				...detachCollabCompartmentEffects(runtime, nextState),
			],
		}).state,
	)
	view.dispatch({
		effects: restored?.scroll ?? runtime.view.EditorView.scrollIntoView(0, { y: "start" }),
	})
}

function cursorInfo(state: EditorRuntimeState): CursorInfo {
	const cursor = state.selection.main.head
	const line = state.doc.lineAt(cursor)
	return { line: line.number - 1, col: cursor - line.from, offset: cursor }
}

async function resolveExtensionFactories(
	runtime: EditorRuntimeModules,
	factories: EditorExtensionFactory[] | undefined,
): Promise<EditorRuntimeExtension[]> {
	if (!factories?.length) return []
	return Promise.all(factories.map((factory) => factory(runtime)))
}

function createBaseExtensionOptions({
	livePreview,
	codeBlockEmbeds,
	resolveImageUrl,
	filePath,
	scrollMode,
	vimCommandProvider,
	commandExecutor,
}: {
	livePreview: boolean
	codeBlockEmbeds?: readonly CodeBlockEmbedDefinition[]
	resolveImageUrl?: (src: string, filePath: string) => string
	filePath: string
	scrollMode: EditorScrollMode
	vimCommandProvider?: VimCommandProvider | null
	commandExecutor?: MarkdownCommandExecutor | null
}): BaseExtensionsOptions {
	return {
		livePreview,
		codeBlockEmbeds,
		resolveImageUrl,
		filePath,
		scrollMode,
		vimCommands: vimCommandProvider,
		commandExecutor,
	}
}

export function EditorView({
	content,
	filePath,
	documentKey,
	editorConfig = DEFAULT_EDITOR_CONFIG,
	livePreview = true,
	codeBlockEmbeds,
	resolveImageUrl,
	extraExtensions,
	scrollMode = "internal",
	vimCommandProvider,
	commandExecutor,
	collab = null,
	onChange,
	onCursorChange,
	onViewReady,
}: Props) {
	const containerRef = useRef<HTMLDivElement>(null)
	const runtimeRef = useRef<EditorRuntimeModules | null>(null)
	const viewRef = useRef<EditorRuntimeView | null>(null)
	const extensionsRef = useRef<EditorRuntimeExtension[]>([])
	const filePathRef = useRef(filePath)
	const documentKeyRef = useRef(documentKey)
	const contentRef = useRef(content)
	const livePreviewRef = useRef(livePreview)
	const codeBlockEmbedsRef = useRef(codeBlockEmbeds)
	const resolveImageUrlRef = useRef(resolveImageUrl)
	const extraExtensionsRef = useRef(extraExtensions)
	const scrollModeRef = useRef(scrollMode)
	const vimCommandProviderRef = useRef(vimCommandProvider)
	const commandExecutorRef = useRef(commandExecutor)
	const onChangeRef = useRef(onChange)
	const onCursorChangeRef = useRef(onCursorChange)
	const onViewReadyRef = useRef(onViewReady)
	const editorConfigRef = useRef(editorConfig)
	const [viewReady, setViewReady] = useState(false)

	contentRef.current = content
	livePreviewRef.current = livePreview
	codeBlockEmbedsRef.current = codeBlockEmbeds
	resolveImageUrlRef.current = resolveImageUrl
	extraExtensionsRef.current = extraExtensions
	scrollModeRef.current = scrollMode
	vimCommandProviderRef.current = vimCommandProvider
	commandExecutorRef.current = commandExecutor
	onChangeRef.current = onChange
	onCursorChangeRef.current = onCursorChange
	onViewReadyRef.current = onViewReady

	useEffect(() => {
		let cancelled = false

		async function mountEditor() {
			const runtime = await loadEditorRuntime()
			if (editorConfigRef.current.vimMode) await loadVimRuntime()
			const extensions = await resolveExtensionFactories(runtime, extraExtensionsRef.current)
			if (cancelled || !containerRef.current) return

			runtimeRef.current = runtime
			const baseOptions = createBaseExtensionOptions({
				livePreview: livePreviewRef.current,
				codeBlockEmbeds: codeBlockEmbedsRef.current,
				resolveImageUrl: resolveImageUrlRef.current,
				filePath: filePathRef.current,
				scrollMode: scrollModeRef.current,
				vimCommandProvider: vimCommandProviderRef.current,
				commandExecutor: commandExecutorRef.current,
			})
			extensionsRef.current = [
				...baseExtensions(runtime, editorConfigRef.current, baseOptions),
				...extensions,
				runtime.view.EditorView.updateListener.of((update: EditorRuntimeViewUpdate) => {
					const remoteUpdate = update.transactions.some((transaction) =>
						isExternalEditorTransaction(runtime, transaction),
					)
					if (update.docChanged && !remoteUpdate) {
						onChangeRef.current(update.state.doc.toString())
					}
					if (update.selectionSet || update.docChanged) {
						onCursorChangeRef.current?.(cursorInfo(update.state))
					}
				}),
			]
			const view = new runtime.view.EditorView({
				state: runtime.state.EditorState.create({
					doc: contentRef.current,
					extensions: extensionsRef.current,
				}),
				parent: containerRef.current,
			}) as EditorRuntimeView

			viewRef.current = view
			setViewReady(true)
			onViewReadyRef.current?.(view)
		}

		void mountEditor()

		return () => {
			cancelled = true
			viewRef.current?.destroy?.()
			viewRef.current = null
			runtimeRef.current = null
		}
	}, [])

	useEffect(() => {
		const view = viewRef.current
		const runtime = runtimeRef.current
		editorConfigRef.current = editorConfig
		if (!view || !runtime) return
		let cancelled = false
		const reconfigure = () =>
			reconfigureEditor(runtime, view, editorConfig, {
				livePreview,
				codeBlockEmbeds,
				resolveImageUrl,
				filePath,
				scrollMode,
				vimCommands: vimCommandProvider,
				commandExecutor,
			})
		if (editorConfig.vimMode && !runtime.vim) {
			void loadVimRuntime().then(() => {
				if (!cancelled && viewRef.current === view) reconfigure()
			})
		} else {
			reconfigure()
		}
		return () => {
			cancelled = true
		}
	}, [
		editorConfig,
		filePath,
		livePreview,
		codeBlockEmbeds,
		resolveImageUrl,
		scrollMode,
		vimCommandProvider,
		commandExecutor,
	])

	useEffect(() => {
		const view = viewRef.current
		const runtime = runtimeRef.current
		contentRef.current = content
		if (!view || !runtime) {
			filePathRef.current = filePath
			documentKeyRef.current = documentKey
			return
		}
		if (documentKey !== undefined && documentKey !== documentKeyRef.current) {
			const previousKey = documentKeyRef.current
			filePathRef.current = filePath
			documentKeyRef.current = documentKey
			swapDocument(runtime, view, extensionsRef.current, previousKey, documentKey, content)
			if (collab) void attachCollabBinding(view, collab, () => viewRef.current === view)
			onCursorChangeRef.current?.(cursorInfo(view.state))
			return
		}
		documentKeyRef.current = documentKey
		if (collab) {
			filePathRef.current = filePath
			return
		}
		const detachEffects = detachCollabCompartmentEffects(runtime, view.state)
		const contentChanged = filePath !== filePathRef.current || view.state.doc.toString() !== content
		if (!contentChanged && detachEffects.length === 0) return
		filePathRef.current = filePath
		view.dispatch({
			changes: contentChanged ? { from: 0, to: view.state.doc.length, insert: content } : undefined,
			effects: detachEffects,
			annotations: [
				runtime.state.Transaction.remote.of(true),
				runtime.state.Transaction.addToHistory.of(false),
			],
		})
	}, [filePath, content, documentKey, collab])

	useEffect(() => {
		const view = viewRef.current
		if (!viewReady || !view || !collab) return
		let current = true
		void attachCollabBinding(view, collab, () => current && viewRef.current === view)
		return () => {
			current = false
		}
	}, [collab, viewReady])

	return <div ref={containerRef} className={`editor-view editor-view-${scrollMode}-scroll`} />
}
