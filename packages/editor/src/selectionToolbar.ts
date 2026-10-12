import type {
	EditorRuntimeExtension,
	EditorRuntimeModules,
	EditorRuntimeView,
	EditorRuntimeViewUpdate,
} from "./types"

export interface SelectionToolbarPosition {
	top: number
	left: number
	placement: "top" | "bottom"
}

export interface SelectionToolbarState {
	from: number
	to: number
	position: SelectionToolbarPosition
}

export interface SelectionToolbarExtensionOptions {
	enabled?: () => boolean
	keepOpen?: () => boolean
	onStateChange: (state: SelectionToolbarState | null) => void
}

const TOOLBAR_HEIGHT = 40
const TOOLBAR_MARGIN = 8

function getToolbarPosition(
	view: EditorRuntimeView,
	from: number,
	to: number,
): SelectionToolbarPosition | null {
	const start = view.coordsAtPos(from, 1)
	const end = view.coordsAtPos(to, -1)
	if (!start || !end) return null
	const top = Math.min(start.top, end.top)
	const bottom = Math.max(start.bottom, end.bottom)
	const left = start.top === end.top ? (start.left + end.left) / 2 : start.left
	const opensBelow = top - TOOLBAR_HEIGHT - TOOLBAR_MARGIN < 0
	return {
		left,
		top: opensBelow ? bottom + TOOLBAR_MARGIN : top - TOOLBAR_MARGIN,
		placement: opensBelow ? "bottom" : "top",
	}
}

function stateKey(state: SelectionToolbarState | null): string {
	if (!state) return "closed"
	const { position } = state
	return `${state.from}:${state.to}:${Math.round(position.left)}:${Math.round(position.top)}:${position.placement}`
}

export function selectionToolbarExtension(
	runtime: EditorRuntimeModules,
	options: SelectionToolbarExtensionOptions,
): EditorRuntimeExtension {
	class SelectionToolbarViewPlugin {
		private pointerDown = false
		private dismissed = false
		private emittedKey = stateKey(null)
		private readonly measureKey = {}
		private readonly handlePointerUp = () => {
			if (!this.pointerDown) return
			this.pointerDown = false
			this.refresh()
		}

		constructor(private view: EditorRuntimeView) {
			view.dom.ownerDocument.addEventListener("pointerup", this.handlePointerUp)
		}

		update(update: EditorRuntimeViewUpdate) {
			if (update.selectionSet) this.dismissed = false
			if (
				update.docChanged ||
				update.selectionSet ||
				update.viewportChanged ||
				update.focusChanged ||
				update.geometryChanged
			) {
				this.refresh()
			}
		}

		destroy() {
			this.view.dom.ownerDocument.removeEventListener("pointerup", this.handlePointerUp)
			this.emit(null)
		}

		startPointer(): void {
			this.pointerDown = true
			this.emit(null)
		}

		dismiss(): boolean {
			if (this.emittedKey === stateKey(null)) return false
			this.dismissed = true
			this.emit(null)
			return true
		}

		refresh(): void {
			const selection = this.view.state.selection.main
			if (
				(options.enabled && !options.enabled()) ||
				this.pointerDown ||
				this.dismissed ||
				selection.empty ||
				(!this.view.hasFocus && !options.keepOpen?.())
			) {
				this.emit(null)
				return
			}
			const { from, to } = selection
			this.view.requestMeasure({
				key: this.measureKey,
				read: () => getToolbarPosition(this.view, from, to),
				write: (position) => {
					const current = this.view.state.selection.main
					if (current.from !== from || current.to !== to) return
					this.emit(position ? { from, to, position } : null)
				},
			})
		}

		private emit(state: SelectionToolbarState | null): void {
			const key = stateKey(state)
			if (key === this.emittedKey) return
			this.emittedKey = key
			options.onStateChange(state)
		}
	}

	const plugin = runtime.view.ViewPlugin.fromClass(SelectionToolbarViewPlugin, {
		eventHandlers: {
			pointerdown() {
				this.startPointer()
			},
		},
	})

	return [
		plugin,
		runtime.state.Prec.high(
			runtime.view.keymap.of([
				{ key: "Escape", run: (view) => view.plugin(plugin)?.dismiss() ?? false },
			]),
		),
	]
}
