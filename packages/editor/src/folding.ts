import type { EditorState, Facet, Line } from "@codemirror/state"
import type { EditorRuntimeExtension, EditorRuntimeModules, EditorRuntimeView } from "./types"

export interface EditorFoldRange {
	toLine: number
	placeholder?: string
}

export interface EditorFoldContext {
	filePath: string | null
	lineNumber: number
	lineText: string
	lineCount: number
	getLine(lineNumber: number): string | null
}

export interface EditorFoldProvider {
	id: string
	label?: string
	priority?: number
	pluginId?: string
	registrationKey?: string
	getFoldRange(context: EditorFoldContext): EditorFoldRange | null
}

interface FoldPositionRange {
	from: number
	to: number
	placeholder?: string
}

interface FoldPlaceholderInfo {
	lineCount: number
	text?: string
}

interface FoldActionRange {
	from: number
	to: number
	folded: boolean
}

const pluginPlaceholderTextByRange = new Map<string, string>()
const warnedFoldProviders = new Set<string>()
let editorFilePathFacet: Facet<string | null, string | null> | null = null

function getEditorFilePathFacet(
	runtime: EditorRuntimeModules,
): Facet<string | null, string | null> {
	editorFilePathFacet ??= runtime.state.Facet.define<string | null, string | null>({
		combine: (values) => values[values.length - 1] ?? null,
	})
	return editorFilePathFacet
}

export function editorFilePathExtension(
	runtime: EditorRuntimeModules,
	filePath?: string,
): EditorRuntimeExtension {
	return getEditorFilePathFacet(runtime).of(filePath ?? null)
}

function readEditorFilePath(state: EditorState): string | null {
	return editorFilePathFacet ? state.facet(editorFilePathFacet) : null
}

function countIndentedColumns(text: string): number {
	let count = 0
	for (const char of text) {
		if (char === " ") count += 1
		else if (char === "\t") count += 4
		else break
	}
	return count
}

function lineRange(fromLine: Line, toLine: Line, placeholder?: string): FoldPositionRange | null {
	if (toLine.number <= fromLine.number || toLine.to <= fromLine.to) return null
	return { from: fromLine.to, to: toLine.to, placeholder }
}

function findHeadingFold(state: EditorState, line: Line): FoldPositionRange | null {
	const headingMatch = line.text.match(/^(#{1,6})\s+\S/)
	if (!headingMatch) return null
	const headingLevel = headingMatch[1].length
	let targetLineNumber = state.doc.lines

	for (
		let nextLineNumber = line.number + 1;
		nextLineNumber <= state.doc.lines;
		nextLineNumber += 1
	) {
		const nextLine = state.doc.line(nextLineNumber)
		const nextHeadingMatch = nextLine.text.match(/^(#{1,6})\s+\S/)
		if (nextHeadingMatch && nextHeadingMatch[1].length <= headingLevel) {
			targetLineNumber = nextLineNumber - 1
			break
		}
	}

	return lineRange(line, state.doc.line(targetLineNumber))
}

function findFencedCodeFold(state: EditorState, line: Line): FoldPositionRange | null {
	const fenceMatch = line.text.match(/^\s*(`{3,}|~{3,})/)
	if (!fenceMatch) return null
	const openingFence = fenceMatch[1]
	const fenceCharacter = openingFence[0]
	const closingPattern = new RegExp(`^\\s*${fenceCharacter}{${openingFence.length},}\\s*$`)

	for (
		let nextLineNumber = line.number + 1;
		nextLineNumber <= state.doc.lines;
		nextLineNumber += 1
	) {
		const nextLine = state.doc.line(nextLineNumber)
		if (closingPattern.test(nextLine.text)) return lineRange(line, nextLine)
	}

	return null
}

function isInsideFencedCodeBlock(state: EditorState, lineNumber: number): boolean {
	let openFence: string | null = null

	for (let currentLineNumber = 1; currentLineNumber < lineNumber; currentLineNumber += 1) {
		const currentLine = state.doc.line(currentLineNumber)
		const fenceMatch = currentLine.text.match(/^\s*(`{3,}|~{3,})/)
		if (!fenceMatch) continue
		const fence = fenceMatch[1]
		if (!openFence) {
			openFence = fence
			continue
		}
		if (fence[0] === openFence[0] && fence.length >= openFence.length) openFence = null
	}

	return openFence !== null
}

function findBlockquoteFold(state: EditorState, line: Line): FoldPositionRange | null {
	if (!/^\s*>\s?/.test(line.text)) return null
	let targetLineNumber = line.number

	for (
		let nextLineNumber = line.number + 1;
		nextLineNumber <= state.doc.lines;
		nextLineNumber += 1
	) {
		const nextLine = state.doc.line(nextLineNumber)
		if (/^\s*>\s?/.test(nextLine.text)) {
			targetLineNumber = nextLineNumber
			continue
		}
		if (
			nextLine.text.trim() === "" &&
			nextLineNumber < state.doc.lines &&
			/^\s*>\s?/.test(state.doc.line(nextLineNumber + 1).text)
		) {
			targetLineNumber = nextLineNumber
			continue
		}
		break
	}

	return lineRange(line, state.doc.line(targetLineNumber))
}

function findListFold(state: EditorState, line: Line): FoldPositionRange | null {
	const listMatch = line.text.match(/^(\s*)(?:[-+*]|\d+[.)])\s+/)
	if (!listMatch) return null
	const baseIndent = countIndentedColumns(listMatch[1])
	let targetLineNumber = line.number

	for (
		let nextLineNumber = line.number + 1;
		nextLineNumber <= state.doc.lines;
		nextLineNumber += 1
	) {
		const nextLine = state.doc.line(nextLineNumber)
		if (nextLine.text.trim() === "") {
			if (targetLineNumber > line.number) targetLineNumber = nextLineNumber
			continue
		}

		const nextIndent = countIndentedColumns(nextLine.text)
		const nextListMatch = nextLine.text.match(/^(\s*)(?:[-+*]|\d+[.)])\s+/)
		const isSameOrNestedList =
			Boolean(nextListMatch) && countIndentedColumns(nextListMatch?.[1] ?? "") >= baseIndent
		if (nextIndent > baseIndent || isSameOrNestedList) {
			targetLineNumber = nextLineNumber
			continue
		}
		break
	}

	return lineRange(line, state.doc.line(targetLineNumber))
}

function findBuiltInFold(state: EditorState, lineStart: number): FoldPositionRange | null {
	const line = state.doc.lineAt(lineStart)
	const fencedCodeFold = findFencedCodeFold(state, line)
	if (fencedCodeFold) return fencedCodeFold
	if (isInsideFencedCodeBlock(state, line.number)) return null
	return (
		findHeadingFold(state, line) ?? findBlockquoteFold(state, line) ?? findListFold(state, line)
	)
}

function buildPluginFoldContext(state: EditorState, line: Line): EditorFoldContext {
	return {
		filePath: readEditorFilePath(state),
		lineNumber: line.number,
		lineText: line.text,
		lineCount: state.doc.lines,
		getLine(lineNumber) {
			if (lineNumber < 1 || lineNumber > state.doc.lines) return null
			return state.doc.line(lineNumber).text
		},
	}
}

function getProviderWarningKey(provider: EditorFoldProvider): string {
	return provider.registrationKey ?? `${provider.pluginId ?? "plugin"}:${provider.id}`
}

function warnFoldProvider(provider: EditorFoldProvider, error: unknown): void {
	const key = getProviderWarningKey(provider)
	if (warnedFoldProviders.has(key)) return
	warnedFoldProviders.add(key)
	console.warn("Editor fold provider failed", { providerId: key, error })
}

function rememberPluginPlaceholder(range: FoldPositionRange): void {
	if (!range.placeholder) return
	if (pluginPlaceholderTextByRange.size > 500) pluginPlaceholderTextByRange.clear()
	pluginPlaceholderTextByRange.set(`${range.from}:${range.to}`, range.placeholder)
}

function findPluginFold(
	state: EditorState,
	lineStart: number,
	providers: readonly EditorFoldProvider[],
): FoldPositionRange | null {
	if (providers.length === 0) return null
	const line = state.doc.lineAt(lineStart)
	const context = buildPluginFoldContext(state, line)

	for (const provider of providers) {
		try {
			const foldRange = provider.getFoldRange(context)
			if (!foldRange || typeof foldRange !== "object") continue
			const toLine = foldRange.toLine
			if (!Number.isInteger(toLine) || toLine <= line.number || toLine > state.doc.lines) continue
			const range = lineRange(
				line,
				state.doc.line(toLine),
				typeof foldRange.placeholder === "string" ? foldRange.placeholder : undefined,
			)
			if (range) {
				rememberPluginPlaceholder(range)
				return range
			}
		} catch (error) {
			warnFoldProvider(provider, error)
		}
	}

	return null
}

function prepareFoldPlaceholder(state: EditorState, range: { from: number; to: number }) {
	const fromLine = state.doc.lineAt(range.from)
	const toLine = state.doc.lineAt(range.to)
	const text = pluginPlaceholderTextByRange.get(`${range.from}:${range.to}`)
	return {
		lineCount: Math.max(1, toLine.number - fromLine.number),
		text,
	} satisfies FoldPlaceholderInfo
}

function renderFoldPlaceholder(
	_view: EditorRuntimeView,
	onclick: (event: Event) => void,
	prepared: FoldPlaceholderInfo,
): HTMLElement {
	const placeholder = document.createElement("span")
	placeholder.className = "cm-fold-placeholder"
	placeholder.textContent = prepared.text ?? `... ${prepared.lineCount} lines`
	placeholder.addEventListener("click", onclick)
	return placeholder
}

function findFoldedRange(
	runtime: EditorRuntimeModules,
	state: EditorState,
	line: Line,
): FoldActionRange | null {
	let foldRange: FoldActionRange | null = null
	runtime.language.foldedRanges(state).between(line.from, line.to + 1, (from, to) => {
		foldRange = { from, to, folded: true }
		return false
	})
	return foldRange
}

function findFoldActionRange(
	runtime: EditorRuntimeModules,
	state: EditorState,
	line: Line,
): FoldActionRange | null {
	const foldedRange = findFoldedRange(runtime, state, line)
	if (foldedRange) return foldedRange
	const foldRange = runtime.language.foldable(state, line.from, line.to)
	return foldRange ? { ...foldRange, folded: false } : null
}

function foldHoverControlExtension(runtime: EditorRuntimeModules): EditorRuntimeExtension {
	return runtime.view.ViewPlugin.fromClass(
		class {
			private readonly button: HTMLButtonElement
			private actionRange: FoldActionRange | null = null

			constructor(private readonly view: EditorRuntimeView) {
				this.button = document.createElement("button")
				this.button.type = "button"
				this.button.className = "cm-fold-hover-control"
				this.button.setAttribute("aria-label", "Fold line")
				this.button.addEventListener("click", this.handleClick)
				this.view.scrollDOM.appendChild(this.button)
				this.view.dom.addEventListener("mousemove", this.handleMouseMove)
				this.view.dom.addEventListener("mouseleave", this.handleMouseLeave)
			}

			destroy(): void {
				this.view.dom.removeEventListener("mousemove", this.handleMouseMove)
				this.view.dom.removeEventListener("mouseleave", this.handleMouseLeave)
				this.button.removeEventListener("click", this.handleClick)
				this.button.remove()
			}

			private readonly handleMouseMove = (event: MouseEvent): void => {
				if (this.button.contains(event.target as Node)) return
				const position = this.view.posAtCoords({ x: event.clientX, y: event.clientY })
				if (position === null) {
					this.hide()
					return
				}
				const block = this.view.lineBlockAt(position)
				const line = this.view.state.doc.lineAt(block.from)
				const actionRange = findFoldActionRange(runtime, this.view.state, line)
				if (!actionRange) {
					this.hide()
					return
				}

				this.actionRange = actionRange
				this.button.style.top = `${block.top}px`
				this.button.style.height = `${block.height}px`
				this.button.dataset.visible = "true"
				this.button.dataset.open = actionRange.folded ? "false" : "true"
				this.button.setAttribute("aria-label", actionRange.folded ? "Unfold line" : "Fold line")
			}

			private readonly handleMouseLeave = (): void => {
				this.hide()
			}

			private readonly handleClick = (event: MouseEvent): void => {
				event.preventDefault()
				event.stopPropagation()
				const actionRange = this.actionRange
				if (!actionRange) return
				this.view.dispatch({
					effects: actionRange.folded
						? runtime.language.unfoldEffect.of({ from: actionRange.from, to: actionRange.to })
						: runtime.language.foldEffect.of({ from: actionRange.from, to: actionRange.to }),
				})
				this.hide()
			}

			private hide(): void {
				this.actionRange = null
				delete this.button.dataset.visible
			}
		},
	)
}

export function foldingExtension(runtime: EditorRuntimeModules): EditorRuntimeExtension {
	return [
		runtime.language.codeFolding({
			placeholderDOM: renderFoldPlaceholder,
			preparePlaceholder: prepareFoldPlaceholder,
		}),
		foldHoverControlExtension(runtime),
		runtime.language.foldService.of((state, lineStart) => {
			const foldRange = findBuiltInFold(state, lineStart)
			return foldRange ? { from: foldRange.from, to: foldRange.to } : null
		}),
	]
}

export function pluginFoldingExtension(
	runtime: EditorRuntimeModules,
	providers: readonly EditorFoldProvider[] = [],
): EditorRuntimeExtension {
	if (providers.length === 0) return []
	return runtime.language.foldService.of((state, lineStart) => {
		const foldRange = findPluginFold(state, lineStart, providers)
		return foldRange ? { from: foldRange.from, to: foldRange.to } : null
	})
}
