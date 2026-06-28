import type {
	EditorRuntimeExtension,
	EditorRuntimeModules,
	EditorRuntimeView,
	EditorRuntimeViewUpdate,
} from "./types"

export interface SlashCommandItem {
	id: string
	label: string
	category: string
	aliases?: readonly string[]
	shortcut?: string
}

export interface SlashCommandMenuPosition {
	top: number
	left: number
	placement: "top" | "bottom"
}

export interface SlashCommandMenuState {
	query: string
	selectedIndex: number
	items: readonly SlashCommandItem[]
	position: SlashCommandMenuPosition
	select: (index: number) => void
	execute: (commandId: string) => boolean
	dismiss: () => void
}

export interface SlashCommandExtensionOptions {
	enabled?: () => boolean
	getItems: () => readonly SlashCommandItem[]
	onStateChange: (state: SlashCommandMenuState | null) => void
	onExecuteCommand: (commandId: string, view: EditorRuntimeView) => void
	itemLimit?: number
}

interface SlashCommandMatch {
	from: number
	to: number
	query: string
}

interface SlashCommandSession {
	match: SlashCommandMatch
	items: readonly SlashCommandItem[]
	selectedIndex: number
	position: SlashCommandMenuPosition | null
}

interface SlashCommandScore {
	item: SlashCommandItem
	score: number
	index: number
}

const DEFAULT_ITEM_LIMIT = 9
const MAX_QUERY_LENGTH = 64
const MENU_WIDTH = 320
const MENU_MAX_HEIGHT = 300
const MENU_MARGIN = 10
const CODE_NODE_NAMES = new Set(["FencedCode", "CodeBlock", "InlineCode", "CodeText"])

function normalizeSearchText(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
}

function getSlashMatch(
	view: EditorRuntimeView,
	runtime: EditorRuntimeModules,
): SlashCommandMatch | null {
	const { state } = view
	const selection = state.selection.main
	if (!selection.empty) return null
	if (state.facet(runtime.state.EditorState.readOnly)) return null

	const line = state.doc.lineAt(selection.head)
	const textBeforeCursor = state.sliceDoc(line.from, selection.head)
	const match = /(?:^|\s)\/([^\s/]*)$/.exec(textBeforeCursor)
	if (!match) return null
	const query = match[1]
	if (query.length > MAX_QUERY_LENGTH) return null

	const from = selection.head - query.length - 1
	if (isInsideCode(runtime, state, from + 1)) return null

	return { from, to: selection.head, query }
}

function isInsideCode(
	runtime: EditorRuntimeModules,
	state: EditorRuntimeView["state"],
	position: number,
): boolean {
	let node = runtime.language.syntaxTree(state).resolveInner(position, -1)
	while (node) {
		if (CODE_NODE_NAMES.has(node.name)) return true
		const parent = node.parent
		if (!parent) break
		node = parent
	}
	return false
}

function scoreItem(item: SlashCommandItem, query: string, index: number): SlashCommandScore | null {
	const normalizedQuery = normalizeSearchText(query)
	if (!normalizedQuery) return { item, score: 0, index }

	const label = normalizeSearchText(item.label)
	const aliases = item.aliases?.map(normalizeSearchText) ?? []
	const haystack = [label, item.id, item.category, ...aliases].join(" ")

	if (label.startsWith(normalizedQuery)) return { item, score: 0, index }
	if (label.split(" ").some((part) => part.startsWith(normalizedQuery))) {
		return { item, score: 1, index }
	}
	if (aliases.some((alias) => alias.startsWith(normalizedQuery))) return { item, score: 2, index }
	if (haystack.includes(normalizedQuery)) return { item, score: 3, index }

	return null
}

function filterItems(
	items: readonly SlashCommandItem[],
	query: string,
	itemLimit: number,
): SlashCommandItem[] {
	return items
		.map((item, index) => scoreItem(item, query, index))
		.filter((score): score is SlashCommandScore => score !== null)
		.sort((left, right) => left.score - right.score || left.index - right.index)
		.slice(0, itemLimit)
		.map((score) => score.item)
}

function getMenuPosition(
	view: EditorRuntimeView,
	match: SlashCommandMatch,
): SlashCommandMenuPosition {
	const editorRect = view.dom.getBoundingClientRect()
	const coordinates = getCoordinatesAtPos(view, match.to, -1) ??
		getCoordinatesAtPos(view, match.to, 1) ??
		getCoordinatesAtPos(view, match.from) ?? {
			left: editorRect.left,
			right: editorRect.left,
			top: editorRect.top,
			bottom: editorRect.top,
		}
	const viewportWidth = window.innerWidth || document.documentElement.clientWidth || MENU_WIDTH
	const viewportHeight =
		window.innerHeight || document.documentElement.clientHeight || MENU_MAX_HEIGHT
	const left = Math.max(
		MENU_MARGIN,
		Math.min(coordinates.left, viewportWidth - MENU_WIDTH - MENU_MARGIN),
	)
	const opensAbove = coordinates.bottom + MENU_MAX_HEIGHT + MENU_MARGIN > viewportHeight

	return {
		left,
		top: opensAbove ? coordinates.top - MENU_MARGIN : coordinates.bottom + MENU_MARGIN,
		placement: opensAbove ? "top" : "bottom",
	}
}

function getCoordinatesAtPos(view: EditorRuntimeView, position: number, side: -1 | 1 = 1) {
	try {
		return view.coordsAtPos(position, side)
	} catch (_error) {
		return null
	}
}

function sessionKey(session: SlashCommandSession | null): string {
	if (!session) return "closed"
	const itemIds = session.items.map((item) => item.id).join(",")
	const position = session.position
		? `${Math.round(session.position.left)}:${Math.round(session.position.top)}:${session.position.placement}`
		: "measuring"
	return `${session.match.from}:${session.match.to}:${session.match.query}:${session.selectedIndex}:${itemIds}:${position}`
}

function isSameMatch(left: SlashCommandMatch | undefined, right: SlashCommandMatch): boolean {
	return left?.from === right.from && left.to === right.to && left.query === right.query
}

export function slashCommandExtension(
	runtime: EditorRuntimeModules,
	options: SlashCommandExtensionOptions,
): EditorRuntimeExtension {
	class SlashCommandViewPlugin {
		private session: SlashCommandSession | null = null
		private emittedKey = sessionKey(null)
		private readonly measureKey = {}

		constructor(private view: EditorRuntimeView) {}

		update(update: EditorRuntimeViewUpdate) {
			if (update.docChanged || update.selectionSet || update.viewportChanged) {
				this.refresh()
			}
		}

		destroy() {
			this.close()
		}

		moveSelection(delta: number): boolean {
			if (!this.session?.items.length) return false
			const count = this.session.items.length
			const selectedIndex = (this.session.selectedIndex + delta + count) % count
			this.session = { ...this.session, selectedIndex }
			this.emit()
			return true
		}

		select(index: number): void {
			if (!this.session?.items.length) return
			const selectedIndex = Math.max(0, Math.min(index, this.session.items.length - 1))
			if (selectedIndex === this.session.selectedIndex) return
			this.session = { ...this.session, selectedIndex }
			this.emit()
		}

		runSelected(): boolean {
			const item = this.session?.items[this.session.selectedIndex]
			return item ? this.execute(item.id) : false
		}

		execute(commandId: string): boolean {
			const session = this.session
			const item = session?.items.find((candidate) => candidate.id === commandId)
			if (!session || !item) return false

			this.view.dispatch({
				changes: { from: session.match.from, to: session.match.to, insert: "" },
				selection: { anchor: session.match.from },
			})
			options.onExecuteCommand(item.id, this.view)
			this.close()
			this.view.focus()
			return true
		}

		close(): boolean {
			if (!this.session) return false
			this.session = null
			this.emit()
			return true
		}

		private refresh(): void {
			if (options.enabled && !options.enabled()) {
				this.close()
				return
			}

			const match = getSlashMatch(this.view, runtime)
			if (!match) {
				this.close()
				return
			}

			const items = filterItems(
				options.getItems(),
				match.query,
				options.itemLimit ?? DEFAULT_ITEM_LIMIT,
			)
			const selectedIndex = Math.min(
				this.session?.selectedIndex ?? 0,
				Math.max(0, items.length - 1),
			)

			this.session = {
				match,
				items,
				selectedIndex,
				position: isSameMatch(this.session?.match, match) ? (this.session?.position ?? null) : null,
			}
			this.measurePosition(match)
			this.emit()
		}

		private measurePosition(match: SlashCommandMatch): void {
			this.view.requestMeasure({
				key: this.measureKey,
				read: () => getMenuPosition(this.view, match),
				write: (position) => {
					if (
						!this.session ||
						this.session.match.from !== match.from ||
						this.session.match.to !== match.to ||
						this.session.match.query !== match.query
					) {
						return
					}
					this.session = { ...this.session, position }
					this.emit()
				},
			})
		}

		private emit(): void {
			const key = sessionKey(this.session)
			if (key === this.emittedKey) return
			this.emittedKey = key

			if (!this.session?.position) {
				options.onStateChange(null)
				return
			}

			options.onStateChange({
				query: this.session.match.query,
				selectedIndex: this.session.selectedIndex,
				items: this.session.items,
				position: this.session.position,
				select: (index) => this.select(index),
				execute: (commandId) => this.execute(commandId),
				dismiss: () => {
					this.close()
				},
			})
		}
	}

	const plugin = runtime.view.ViewPlugin.fromClass(SlashCommandViewPlugin)

	return [
		plugin,
		runtime.state.Prec.highest(
			runtime.view.keymap.of([
				{
					key: "ArrowDown",
					run: (view) => view.plugin(plugin)?.moveSelection(1) ?? false,
				},
				{
					key: "ArrowUp",
					run: (view) => view.plugin(plugin)?.moveSelection(-1) ?? false,
				},
				{
					key: "Enter",
					run: (view) => view.plugin(plugin)?.runSelected() ?? false,
				},
				{
					key: "Escape",
					run: (view) => view.plugin(plugin)?.close() ?? false,
				},
			]),
		),
	]
}
