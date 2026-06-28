import type * as CodeMirrorAutocomplete from "@codemirror/autocomplete"
import type * as CodeMirrorCommands from "@codemirror/commands"
import type * as CodeMirrorLangCss from "@codemirror/lang-css"
import type * as CodeMirrorLangHtml from "@codemirror/lang-html"
import type * as CodeMirrorLangJavascript from "@codemirror/lang-javascript"
import type * as CodeMirrorLangJson from "@codemirror/lang-json"
import type * as CodeMirrorLangMarkdown from "@codemirror/lang-markdown"
import type * as CodeMirrorLangPython from "@codemirror/lang-python"
import type * as CodeMirrorLangRust from "@codemirror/lang-rust"
import type * as CodeMirrorLangSql from "@codemirror/lang-sql"
import type * as CodeMirrorLangYaml from "@codemirror/lang-yaml"
import type * as CodeMirrorLanguage from "@codemirror/language"
import type * as CodeMirrorSearch from "@codemirror/search"
import type {
	EditorState as CodeMirrorEditorState,
	Compartment,
	Extension,
	Range,
	RangeSet,
	RangeValue,
	StateEffect,
	StateEffectType,
	StateField,
	Transaction,
	TransactionSpec,
} from "@codemirror/state"
import type {
	BlockWrapper,
	EditorView as CodeMirrorEditorView,
	Decoration,
	DecorationSet,
	KeyBinding,
	ViewUpdate,
} from "@codemirror/view"
import type * as LezerHighlight from "@lezer/highlight"
import type * as LezerMarkdown from "@lezer/markdown"
import type * as CodeMirrorVim from "@replit/codemirror-vim"

export interface CursorInfo {
	line: number
	col: number
	offset: number
}

export type EditorScrollMode = "internal" | "parent"

export interface EditorConfig {
	fontSize: number
	wordWrap: boolean
	folding: boolean
	tabSize: number
	useSpaces: boolean
	showLineNumbers: boolean
	vimMode?: boolean
}

export interface EditorSelectionRange {
	from: number
	to: number
	head: number
	empty?: boolean
}

export interface EditorSelectionState {
	main: EditorSelectionRange
	ranges: readonly EditorSelectionRange[]
}

export type EditorRuntimeState = CodeMirrorEditorState
export type EditorRuntimeView = CodeMirrorEditorView
export type EditorTransactionSpec = TransactionSpec
export type EditorRuntimeTransaction = Transaction
export type EditorRuntimeViewUpdate = ViewUpdate
export type EditorRuntimeCompartment = Compartment
export type EditorRuntimeExtension = Extension
export type EditorRuntimeKeyBinding = KeyBinding
export type EditorRuntimeStateEffect<Value = unknown> = StateEffect<Value>
export type EditorRuntimeStateEffectType<Value = unknown> = StateEffectType<Value>
export type EditorRuntimeStateField<Value> = StateField<Value>
export type EditorRuntimeDecoration = Decoration
export type EditorRuntimeBlockWrapper = BlockWrapper
export type EditorRuntimeRange<Value extends RangeValue = RangeValue> = Range<Value>
export type EditorRuntimeDecorationRange = Range<Decoration>
export type EditorRuntimeBlockWrapperRange = Range<BlockWrapper>
export type EditorRuntimeDecorationSet = DecorationSet
export type EditorRuntimeBlockWrapperSet = RangeSet<BlockWrapper>

export interface EditorRuntimeModules {
	autocomplete: typeof CodeMirrorAutocomplete
	commands: typeof CodeMirrorCommands
	langCss: typeof CodeMirrorLangCss
	langHtml: typeof CodeMirrorLangHtml
	langJavascript: typeof CodeMirrorLangJavascript
	langJson: typeof CodeMirrorLangJson
	langMarkdown: typeof CodeMirrorLangMarkdown
	langPython: typeof CodeMirrorLangPython
	langRust: typeof CodeMirrorLangRust
	langSql: typeof CodeMirrorLangSql
	langYaml: typeof CodeMirrorLangYaml
	language: typeof CodeMirrorLanguage
	search: typeof CodeMirrorSearch
	state: typeof import("@codemirror/state")
	view: typeof import("@codemirror/view")
	lezerHighlight: typeof LezerHighlight
	lezerMarkdown: typeof LezerMarkdown
	vim: typeof CodeMirrorVim
}

export type EditorExtensionFactory = (
	runtime: EditorRuntimeModules,
) => EditorRuntimeExtension | Promise<EditorRuntimeExtension>

export type EditorCommand = (view: EditorRuntimeView) => boolean | Promise<boolean>

export interface VimCommandChoice {
	name: string
	commandId: string
	label: string
	category: string
	isPrimary: boolean
}

export interface VimCommandProvider {
	getChoices(): VimCommandChoice[]
	execute(name: string, input?: string): boolean
	subscribe(callback: () => void): () => void
}
