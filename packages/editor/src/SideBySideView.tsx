import { useCallback, useEffect, useRef } from "react"
import { EditorView } from "./EditorView"
import type { MarkdownCommandExecutor } from "./markdownKeymap"
import { ReadingView } from "./ReadingView"
import type {
	EditorConfig,
	EditorExtensionFactory,
	EditorRuntimeView,
	VimCommandProvider,
} from "./types"

interface Props {
	content: string
	filePath: string
	editorConfig?: EditorConfig
	extraExtensions?: EditorExtensionFactory[]
	resolveImageUrl?: (src: string, filePath: string) => string
	scrollMode?: "internal" | "parent"
	vimCommandProvider?: VimCommandProvider | null
	commandExecutor?: MarkdownCommandExecutor | null
	onChange: (content: string) => void
	onViewReady?: (view: EditorRuntimeView) => void
	onWikiLinkClick?: (target: string) => void
	onExternalLinkClick?: (url: string) => void
}

export function SideBySideView({
	content,
	filePath,
	editorConfig,
	extraExtensions,
	resolveImageUrl,
	scrollMode = "internal",
	vimCommandProvider,
	commandExecutor,
	onChange,
	onViewReady,
	onWikiLinkClick,
	onExternalLinkClick,
}: Props) {
	const readingPanelRef = useRef<HTMLDivElement>(null)
	const editorScrollRef = useRef<EditorRuntimeView | null>(null)
	const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const handleEditorScroll = useCallback(() => {
		if (syncTimerRef.current) clearTimeout(syncTimerRef.current)

		syncTimerRef.current = setTimeout(() => {
			const editorView = editorScrollRef.current
			const readingPanel = readingPanelRef.current
			if (!editorView || !readingPanel) return

			const editorScroller = editorView.scrollDOM
			const scrollRatio =
				editorScroller.scrollTop /
				Math.max(1, editorScroller.scrollHeight - editorScroller.clientHeight)

			readingPanel.scrollTop =
				scrollRatio * Math.max(0, readingPanel.scrollHeight - readingPanel.clientHeight)
		}, 30)
	}, [])

	const handleViewReady = useCallback(
		(view: EditorRuntimeView) => {
			editorScrollRef.current?.scrollDOM.removeEventListener("scroll", handleEditorScroll)
			editorScrollRef.current = view
			if (scrollMode === "internal") {
				view.scrollDOM.addEventListener("scroll", handleEditorScroll, { passive: true })
			}
			onViewReady?.(view)
		},
		[handleEditorScroll, onViewReady, scrollMode],
	)

	// oxlint-disable-next-line react-doctor/exhaustive-deps -- unmount cleanup must read the latest editor view and pending timer refs
	useEffect(() => {
		return () => {
			if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
			editorScrollRef.current?.scrollDOM.removeEventListener("scroll", handleEditorScroll)
		}
	}, [handleEditorScroll])

	return (
		<div className={`side-by-side-view side-by-side-view-${scrollMode}-scroll`}>
			<div className="side-by-side-editor">
				<EditorView
					content={content}
					filePath={filePath}
					editorConfig={editorConfig}
					extraExtensions={extraExtensions}
					livePreview={true}
					resolveImageUrl={resolveImageUrl}
					scrollMode={scrollMode}
					vimCommandProvider={vimCommandProvider}
					commandExecutor={commandExecutor}
					onChange={onChange}
					onViewReady={handleViewReady}
				/>
			</div>
			<div className="side-by-side-preview" ref={readingPanelRef}>
				<ReadingView
					content={content}
					renderDelay={80}
					scrollMode={scrollMode}
					onWikiLinkClick={onWikiLinkClick}
					onExternalLinkClick={onExternalLinkClick}
				/>
			</div>
		</div>
	)
}
