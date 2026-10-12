import { loadEditorRuntime } from "./runtime"
import type {
	EditorRuntimeDecorationSet,
	EditorRuntimeExtension,
	EditorRuntimeModules,
	EditorRuntimeStateEffectType,
	EditorRuntimeStateField,
	EditorRuntimeView,
} from "./types"

export interface CommentAnchorRange {
	threadId: string
	from: number
	to: number
	resolved: boolean
}

export interface CommentAnchorsUpdate {
	ranges: readonly CommentAnchorRange[]
	focusedThreadId: string | null
}

export interface CommentThreadPreview {
	authorName: string
	body: string
	commentCount: number
	timeLabel: string
}

export interface CommentsExtensionOptions {
	onAnchorClick: (threadId: string) => void
	getThreadPreview?: (threadId: string) => CommentThreadPreview | null
	onExternalDocChange?: () => void
	onViewReady?: (view: EditorRuntimeView) => void
	onLocalDocChange?: () => void
}

interface CommentAnchorsValue {
	decorations: EditorRuntimeDecorationSet
	focusedThreadId: string | null
}

interface CommentsRuntime {
	setAnchors: EditorRuntimeStateEffectType<CommentAnchorsUpdate>
	field: EditorRuntimeStateField<CommentAnchorsValue>
}

const commentsRuntimes = new WeakMap<EditorRuntimeModules, CommentsRuntime>()

function anchorClassName(range: CommentAnchorRange, focusedThreadId: string | null): string {
	if (range.resolved) return "cm-comment-anchor is-resolved"
	return range.threadId === focusedThreadId ? "cm-comment-anchor is-focused" : "cm-comment-anchor"
}

function getCommentsRuntime(runtime: EditorRuntimeModules): CommentsRuntime {
	const cached = commentsRuntimes.get(runtime)
	if (cached) return cached
	const { Decoration, EditorView } = runtime.view
	const setAnchors = runtime.state.StateEffect.define<CommentAnchorsUpdate>()
	const field = runtime.state.StateField.define<CommentAnchorsValue>({
		create: () => ({ decorations: Decoration.none, focusedThreadId: null }),
		update(value, transaction) {
			let next = transaction.docChanged
				? { ...value, decorations: value.decorations.map(transaction.changes) }
				: value
			for (const effect of transaction.effects) {
				if (!effect.is(setAnchors)) continue
				const length = transaction.state.doc.length
				const ranges = effect.value.ranges
					.filter((range) => range.from < range.to && range.to <= length)
					.sort((left, right) => left.from - right.from || left.to - right.to)
				next = {
					focusedThreadId: effect.value.focusedThreadId,
					decorations: Decoration.set(
						ranges.map((range) =>
							Decoration.mark({
								class: anchorClassName(range, effect.value.focusedThreadId),
								attributes: { "data-comment-thread": range.threadId },
								threadId: range.threadId,
								resolved: range.resolved,
							}).range(range.from, range.to),
						),
					),
				}
			}
			return next
		},
		provide: (stateField) => EditorView.decorations.from(stateField, (value) => value.decorations),
	})
	const commentsRuntime = { setAnchors, field }
	commentsRuntimes.set(runtime, commentsRuntime)
	return commentsRuntime
}

interface CommentAnchorHit {
	threadId: string
	from: number
	to: number
}

function findAnchorAt(value: CommentAnchorsValue, position: number): CommentAnchorHit | null {
	let hit: CommentAnchorHit | null = null
	value.decorations.between(position, position, (from, to, decoration) => {
		const threadId = decoration.spec.threadId
		if (typeof threadId !== "string" || decoration.spec.resolved) return
		if (!hit || to - from < hit.to - hit.from) hit = { threadId, from, to }
	})
	return hit
}

function createElement(tagName: string, className: string, text?: string): HTMLElement {
	const element = document.createElement(tagName)
	element.className = className
	if (text !== undefined) element.textContent = text
	return element
}

function createPreviewTooltip(preview: CommentThreadPreview): HTMLElement {
	const root = createElement("div", "cm-comment-tooltip")
	const header = createElement("div", "cm-comment-tooltip-header")
	header.append(
		createElement("b", "cm-comment-tooltip-author", preview.authorName),
		createElement("span", "cm-comment-tooltip-meta", preview.timeLabel),
	)
	const footer = createElement(
		"div",
		"cm-comment-tooltip-footer",
		preview.commentCount > 1
			? `${preview.commentCount} comments · Click to open`
			: "Click to open thread",
	)
	root.append(header, createElement("p", "cm-comment-tooltip-body", preview.body), footer)
	return root
}

export function commentsExtension(
	runtime: EditorRuntimeModules,
	options: CommentsExtensionOptions,
): EditorRuntimeExtension {
	const { field } = getCommentsRuntime(runtime)
	const { EditorView, ViewPlugin, hoverTooltip } = runtime.view
	return [
		field,
		ViewPlugin.define((view) => {
			queueMicrotask(() => options.onViewReady?.(view))
			return {}
		}),
		EditorView.domEventHandlers({
			click(event, view) {
				if (event.button !== 0 || !view.state.selection.main.empty) return false
				const position = view.posAtCoords({ x: event.clientX, y: event.clientY })
				if (position === null) return false
				const hit = findAnchorAt(view.state.field(field), position)
				if (hit) options.onAnchorClick(hit.threadId)
				return false
			},
		}),
		hoverTooltip(
			(view, position) => {
				const hit = findAnchorAt(view.state.field(field), position)
				const preview = hit ? options.getThreadPreview?.(hit.threadId) : null
				if (!hit || !preview) return null
				return {
					pos: hit.from,
					end: hit.to,
					above: true,
					create: () => ({ dom: createPreviewTooltip(preview) }),
				}
			},
			{ hoverTime: 250 },
		),
		EditorView.updateListener.of((update) => {
			if (!update.docChanged) return
			const external = update.transactions.some(
				(transaction) => transaction.annotation(runtime.state.Transaction.remote) === true,
			)
			if (external) options.onExternalDocChange?.()
			else options.onLocalDocChange?.()
		}),
		EditorView.baseTheme({
			".cm-comment-anchor": {
				backgroundColor: "color-mix(in srgb, var(--status-warning) 22%, transparent)",
				borderBottom: "2px solid color-mix(in srgb, var(--status-warning) 70%, transparent)",
				cursor: "pointer",
			},
			".cm-comment-anchor.is-focused": {
				backgroundColor: "color-mix(in srgb, var(--status-warning) 38%, transparent)",
			},
			".cm-comment-anchor.is-resolved": {
				backgroundColor: "transparent",
				borderBottom: "0",
				cursor: "text",
			},
			".cm-tooltip:has(> .cm-comment-tooltip)": {
				border: "0",
				borderRadius: "10px",
				backgroundColor: "var(--bg-elevated)",
				boxShadow: "var(--shadow-popup)",
			},
			".cm-comment-tooltip": {
				display: "flex",
				maxWidth: "280px",
				flexDirection: "column",
				gap: "4px",
				padding: "10px 12px",
				fontFamily: "var(--font-ui)",
				fontSize: "12px",
				lineHeight: "17px",
				color: "var(--text-primary)",
			},
			".cm-comment-tooltip-header": {
				display: "flex",
				alignItems: "baseline",
				gap: "6px",
			},
			".cm-comment-tooltip-author": {
				fontSize: "13px",
				fontWeight: "600",
			},
			".cm-comment-tooltip-meta, .cm-comment-tooltip-footer": {
				color: "var(--text-muted)",
				fontSize: "11px",
			},
			".cm-comment-tooltip-body": {
				display: "-webkit-box",
				overflow: "hidden",
				margin: "0",
				WebkitBoxOrient: "vertical",
				WebkitLineClamp: "3",
				whiteSpace: "pre-wrap",
			},
		}),
	]
}

export async function setCommentAnchors(
	view: EditorRuntimeView,
	update: CommentAnchorsUpdate,
): Promise<void> {
	const runtime = await loadEditorRuntime()
	const { field, setAnchors } = getCommentsRuntime(runtime)
	if (!view.state.field(field, false)) return
	view.dispatch({ effects: setAnchors.of(update) })
}

export async function getCommentAnchorRanges(
	view: EditorRuntimeView,
): Promise<Map<string, { from: number; to: number }>> {
	const runtime = await loadEditorRuntime()
	const value = view.state.field(getCommentsRuntime(runtime).field, false)
	const ranges = new Map<string, { from: number; to: number }>()
	if (!value) return ranges
	const cursor = value.decorations.iter()
	while (cursor.value) {
		const threadId = cursor.value.spec.threadId
		if (typeof threadId === "string" && cursor.from < cursor.to) {
			ranges.set(threadId, { from: cursor.from, to: cursor.to })
		}
		cursor.next()
	}
	return ranges
}

export async function revealCommentAnchor(
	view: EditorRuntimeView,
	from: number,
	to: number,
): Promise<void> {
	const runtime = await loadEditorRuntime()
	const length = view.state.doc.length
	if (from > length) return
	view.dispatch({
		selection: { anchor: Math.min(from, length), head: Math.min(to, length) },
		effects: runtime.view.EditorView.scrollIntoView(from, { y: "center" }),
	})
}
