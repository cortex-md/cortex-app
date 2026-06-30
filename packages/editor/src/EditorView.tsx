import "./markdown.css"
import { useEffect, useRef } from "react"
import type { CodeBlockEmbedDefinition } from "./codeBlockEmbeds"
import {
	type BaseExtensionsOptions,
	baseExtensions,
	DEFAULT_EDITOR_CONFIG,
	reconfigureEditor,
} from "./extensions"
import type { MarkdownCommandExecutor } from "./markdownKeymap"
import { loadEditorRuntime } from "./runtime"
import type {
	CursorInfo,
	EditorConfig,
	EditorExtensionFactory,
	EditorRuntimeExtension,
	EditorRuntimeModules,
	EditorRuntimeView,
	EditorRuntimeViewUpdate,
	EditorScrollMode,
	VimCommandProvider,
} from "./types"

interface Props {
	content: string
	filePath: string
	editorConfig?: EditorConfig
	livePreview?: boolean
	codeBlockEmbeds?: readonly CodeBlockEmbedDefinition[]
	resolveImageUrl?: (src: string, filePath: string) => string
	extraExtensions?: EditorExtensionFactory[]
	scrollMode?: EditorScrollMode
	vimCommandProvider?: VimCommandProvider | null
	commandExecutor?: MarkdownCommandExecutor | null
	onChange: (content: string) => void
	onCursorChange?: (cursor: CursorInfo) => void
	onViewReady?: (view: EditorRuntimeView) => void
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
	editorConfig = DEFAULT_EDITOR_CONFIG,
	livePreview = true,
	codeBlockEmbeds,
	resolveImageUrl,
	extraExtensions,
	scrollMode = "internal",
	vimCommandProvider,
	commandExecutor,
	onChange,
	onCursorChange,
	onViewReady,
}: Props) {
	const containerRef = useRef<HTMLDivElement>(null)
	const runtimeRef = useRef<EditorRuntimeModules | null>(null)
	const viewRef = useRef<EditorRuntimeView | null>(null)
	const filePathRef = useRef(filePath)
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
			const view = new runtime.view.EditorView({
				state: runtime.state.EditorState.create({
					doc: contentRef.current,
					extensions: [
						...baseExtensions(runtime, editorConfigRef.current, baseOptions),
						...extensions,
						runtime.view.EditorView.updateListener.of((update: EditorRuntimeViewUpdate) => {
							const remoteUpdate = update.transactions.some((transaction) =>
								transaction.annotation(runtime.state.Transaction.remote),
							)
							if (update.docChanged && !remoteUpdate) {
								onChangeRef.current(update.state.doc.toString())
							}
							if (update.selectionSet || update.docChanged) {
								const cursor = update.state.selection.main.head
								const line = update.state.doc.lineAt(cursor)
								onCursorChangeRef.current?.({
									line: line.number - 1,
									col: cursor - line.from,
									offset: cursor,
								})
							}
						}),
					],
				}),
				parent: containerRef.current,
			}) as EditorRuntimeView

			viewRef.current = view
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
		reconfigureEditor(runtime, view, editorConfig, {
			livePreview,
			codeBlockEmbeds,
			resolveImageUrl,
			filePath,
			scrollMode,
			vimCommands: vimCommandProvider,
			commandExecutor,
		})
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
			return
		}
		const currentContent = view.state.doc.toString()
		if (filePath === filePathRef.current && currentContent === content) return
		filePathRef.current = filePath
		view.dispatch({
			changes: { from: 0, to: view.state.doc.length, insert: content },
			annotations: [
				runtime.state.Transaction.remote.of(true),
				runtime.state.Transaction.addToHistory.of(false),
			],
		})
	}, [filePath, content])

	return <div ref={containerRef} className={`editor-view editor-view-${scrollMode}-scroll`} />
}
