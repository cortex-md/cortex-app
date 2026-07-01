import type { CodeBlockEmbedDefinition } from "./codeBlockEmbeds"
import {
	type EditorFoldProvider,
	editorFilePathExtension,
	foldingExtension,
	pluginFoldingExtension,
} from "./folding"
import { buildHighlightStyle } from "./highlight"
import type { LineEmbedDefinition } from "./lineEmbeds"
import { livePreviewExtension } from "./livePreview"
import { defaultMarkdownKeymapExtension, type MarkdownCommandExecutor } from "./markdownKeymap"
import { loadEditorRuntime } from "./runtime"
import { tableAffordancesExtension } from "./tableAffordances"
import { tableEditingExtension, vimTableNavigationExtension } from "./tableEditing"
import { tableResizeExtension } from "./tableResize"
import { tableSelectionExtension } from "./tableSelection"
import type {
	EditorConfig,
	EditorRuntimeCompartment,
	EditorRuntimeExtension,
	EditorRuntimeModules,
	EditorRuntimeView,
	EditorScrollMode,
	VimCommandProvider,
} from "./types"
import { vimCommandExtension } from "./vimCommands"

function createCodeLanguages(runtime: EditorRuntimeModules) {
	const { LanguageDescription } = runtime.language
	return [
		LanguageDescription.of({
			name: "JavaScript",
			alias: ["js"],
			load: async () => runtime.langJavascript.javascript(),
		}),
		LanguageDescription.of({
			name: "TypeScript",
			alias: ["ts"],
			load: async () => runtime.langJavascript.javascript({ typescript: true }),
		}),
		LanguageDescription.of({
			name: "JSX",
			alias: ["jsx"],
			load: async () => runtime.langJavascript.javascript({ jsx: true }),
		}),
		LanguageDescription.of({
			name: "TSX",
			alias: ["tsx"],
			load: async () => runtime.langJavascript.javascript({ jsx: true, typescript: true }),
		}),
		LanguageDescription.of({
			name: "Python",
			alias: ["py"],
			load: async () => runtime.langPython.python(),
		}),
		LanguageDescription.of({
			name: "Rust",
			alias: ["rs"],
			load: async () => runtime.langRust.rust(),
		}),
		LanguageDescription.of({ name: "HTML", load: async () => runtime.langHtml.html() }),
		LanguageDescription.of({ name: "CSS", load: async () => runtime.langCss.css() }),
		LanguageDescription.of({ name: "JSON", load: async () => runtime.langJson.json() }),
		LanguageDescription.of({
			name: "YAML",
			alias: ["yml"],
			load: async () => runtime.langYaml.yaml(),
		}),
		LanguageDescription.of({ name: "SQL", load: async () => runtime.langSql.sql() }),
	]
}

export const DEFAULT_EDITOR_CONFIG: EditorConfig = {
	fontSize: 16,
	wordWrap: true,
	folding: true,
	tabSize: 2,
	useSpaces: true,
	showLineNumbers: false,
	vimMode: false,
}

interface EditorCompartments {
	vim: EditorRuntimeCompartment
	filePath: EditorRuntimeCompartment
	livePreview: EditorRuntimeCompartment
	typography: EditorRuntimeCompartment
	lineWrapping: EditorRuntimeCompartment
	indent: EditorRuntimeCompartment
	lineNumbers: EditorRuntimeCompartment
	folding: EditorRuntimeCompartment
	pluginFolding: EditorRuntimeCompartment
	pluginExtensions: EditorRuntimeCompartment
}

let editorCompartments: EditorCompartments | null = null

function getEditorCompartments(runtime: EditorRuntimeModules): EditorCompartments {
	editorCompartments ??= {
		vim: new runtime.state.Compartment(),
		filePath: new runtime.state.Compartment(),
		livePreview: new runtime.state.Compartment(),
		typography: new runtime.state.Compartment(),
		lineWrapping: new runtime.state.Compartment(),
		indent: new runtime.state.Compartment(),
		lineNumbers: new runtime.state.Compartment(),
		folding: new runtime.state.Compartment(),
		pluginFolding: new runtime.state.Compartment(),
		pluginExtensions: new runtime.state.Compartment(),
	}
	return editorCompartments
}

export function buildEditorTypographyRules(
	fontSize: number,
	scrollMode: EditorScrollMode = "internal",
) {
	const usesParentScroll = scrollMode === "parent"
	return {
		"&": {
			fontSize: `var(--editor-font-size, ${fontSize}px)`,
			fontFamily:
				'var(--font-editor, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
			fontWeight: "var(--editor-font-weight, 400)",
			background: "transparent",
			height: usesParentScroll ? "auto" : "100%",
			...(usesParentScroll ? { minHeight: "inherit" } : {}),
		},
		"&.cm-focused": { outline: "none" },
		".cm-scroller": {
			overflow: usesParentScroll ? "visible" : "auto",
			fontFamily: "inherit",
			lineHeight: "var(--editor-line-height, 27px)",
		},
		".cm-content": {
			padding: usesParentScroll ? "8px 0 24px" : "24px 0",
			caretColor: "var(--accent)",
			maxWidth: "var(--markdown-content-width, 720px)",
			marginInline: "auto",
		},
		".cm-line": {
			position: "relative",
			zIndex: "2",
			padding: "0 var(--markdown-content-gutter, 40px)",
		},
		".cm-activeLine": {
			position: "relative",
			zIndex: "2",
			backgroundColor: "rgba(255,255,255,0.02)",
			padding: "0 var(--markdown-content-gutter, 40px)",
		},
		".cm-cursor": {
			borderLeftColor: "var(--accent)",
			borderLeftWidth: "2px",
		},
		".cm-fat-cursor": {
			background: "var(--accent) !important",
			borderRadius: "1px",
			boxSizing: "border-box",
		},
		"&:not(.cm-focused) .cm-fat-cursor": {
			background: "transparent !important",
			outline: "1px solid var(--accent) !important",
		},
		".cm-content ::selection": {
			backgroundColor: "var(--editor-selection-bg, var(--bg-selected))",
		},
		".cm-selectionBackground": {
			backgroundColor: "var(--editor-selection-bg, var(--bg-selected)) !important",
		},
		".cm-selectionLayer": {
			zIndex: "1 !important",
			pointerEvents: "none",
		},
		".cm-cursorLayer": {
			zIndex: "4",
			pointerEvents: "none",
		},
		".cm-gutters": {
			background: "transparent",
			borderRight: "none",
			color: "var(--text-muted)",
		},
		".cm-fold-hover-control": {
			position: "absolute",
			insetInlineStart:
				"max(8px, calc((100% - min(100%, var(--markdown-content-width, 720px))) / 2 + var(--markdown-content-gutter, 40px) - 30px))",
			zIndex: "6",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: "22px",
			padding: "0",
			color: "var(--text-secondary)",
			background: "transparent",
			border: "none",
			outline: "none",
			opacity: "0",
			pointerEvents: "none",
			cursor: "default",
			transition: "opacity 140ms ease, color 140ms ease",
		},
		'.cm-fold-hover-control[data-visible="true"]': {
			opacity: "0.88",
			pointerEvents: "auto",
		},
		'.cm-fold-hover-control[data-visible="true"]:hover': {
			opacity: "1",
			color: "var(--text-primary)",
		},
		'.cm-fold-hover-control[data-visible="true"]:focus-visible': {
			opacity: "1",
			color: "var(--text-primary)",
			borderRadius: "4px",
			boxShadow: "0 0 0 2px var(--input-focus-ring)",
		},
		".cm-fold-hover-control::before": {
			content: '""',
			display: "block",
			width: "7px",
			height: "7px",
			borderRight: "2px solid currentColor",
			borderBottom: "2px solid currentColor",
			transform: "rotate(-45deg)",
			transformOrigin: "50% 50%",
			transition: "transform 140ms ease",
		},
		'.cm-fold-hover-control[data-open="true"]::before': {
			transform: "rotate(45deg)",
		},
		".cm-fold-placeholder": {
			display: "inline-flex",
			alignItems: "center",
			height: "20px",
			marginInline: "6px",
			padding: "0 7px",
			border: "1px solid var(--border-subtle)",
			borderRadius: "4px",
			color: "var(--text-muted)",
			backgroundColor: "var(--bg-secondary)",
			fontFamily: "var(--font-ui)",
			fontSize: "12px",
			fontVariantNumeric: "tabular-nums",
			lineHeight: "20px",
			cursor: "default",
			userSelect: "none",
		},
		".cm-fold-placeholder:hover": {
			color: "var(--text-secondary)",
			backgroundColor: "var(--bg-hover)",
			borderColor: "var(--border)",
		},
		"@media (prefers-reduced-motion: reduce)": {
			".cm-fold-hover-control": {
				transition: "none",
			},
			".cm-fold-hover-control::before": { transition: "none" },
		},
		".cm-panels": {
			backgroundColor: "var(--bg-elevated)",
			color: "var(--text-primary)",
			fontFamily: "var(--font-ui)",
			fontSize: "var(--ui-font-size, 14px)",
		},
		".cm-panel.cm-search": {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			gap: "6px",
			padding: "8px 40px 8px 10px",
			backgroundColor: "var(--bg-elevated)",
			borderBottom: "1px solid var(--border-subtle)",
			boxShadow: "var(--shadow-raised)",
			position: "relative",
		},
		".cm-panel.cm-vim-panel": {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			gap: "6px",
			minHeight: "34px",
			padding: "4px 10px",
			color: "var(--text-primary)",
			backgroundColor: "var(--bg-elevated)",
			borderTop: "1px solid var(--border-subtle)",
			fontFamily: "var(--font-ui)",
			fontSize: "var(--ui-font-size, 14px)",
		},
		".cm-panel.cm-vim-panel input": {
			flex: "1",
			minWidth: "0",
			height: "24px",
			padding: "0 4px",
			color: "var(--text-primary)",
			backgroundColor: "transparent",
			border: "none",
			fontFamily: "var(--font-editor)",
			fontSize: "var(--ui-font-size, 14px)",
			outline: "none",
		},
		".cm-panel.cm-vim-panel input:focus": {
			boxShadow: "none",
		},
		".cm-panel.cm-vim-panel .cm-vim-message": {
			color: "var(--text-secondary) !important",
			whiteSpace: "pre-wrap",
		},
		".cm-panel.cm-vim-panel > :not(.cm-vim-command-hints)": {
			order: "2",
			flexBasis: "100%",
			display: "flex",
			alignItems: "center",
		},
		".cm-panel.cm-vim-panel .cm-vim-command-hints": {
			order: "1",
			flexBasis: "100%",
			display: "grid",
			gap: "0",
			marginTop: "1px",
			maxHeight: "132px",
			overflowY: "auto",
		},
		".cm-panel.cm-vim-panel .cm-vim-command-hint": {
			display: "flex",
			alignItems: "center",
			gap: "8px",
			minHeight: "22px",
			padding: "0 4px",
			color: "var(--text-muted)",
			backgroundColor: "transparent",
		},
		'.cm-panel.cm-vim-panel .cm-vim-command-hint[data-selected="true"]': {
			color: "var(--text-primary)",
			backgroundColor: "var(--bg-hover)",
		},
		".cm-panel.cm-vim-panel .cm-vim-command-hint-name": {
			fontFamily: "var(--font-editor)",
			fontSize: "12px",
		},
		".cm-panel.cm-vim-panel .cm-vim-command-hint-label": {
			minWidth: "0",
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			fontSize: "12px",
			color: "var(--text-muted)",
		},
		".cm-panel.cm-search br": {
			display: "none",
		},
		".cm-panel.cm-search .cm-textfield": {
			height: "28px",
			minWidth: "180px",
			padding: "0 8px",
			color: "var(--text-primary)",
			backgroundColor: "var(--input-bg)",
			border: "1px solid var(--input-border)",
			borderRadius: "4px",
			font: "inherit",
			outline: "none",
		},
		".cm-panel.cm-search .cm-textfield:focus": {
			borderColor: "var(--border-focus)",
			boxShadow: "0 0 0 2px var(--input-focus-ring)",
		},
		".cm-panel.cm-search .cm-button": {
			height: "28px",
			padding: "0 9px",
			color: "var(--text-secondary)",
			backgroundImage: "none",
			backgroundColor: "var(--bg-secondary)",
			border: "1px solid var(--border-subtle)",
			borderRadius: "4px",
			font: "inherit",
			cursor: "default",
		},
		".cm-panel.cm-search .cm-button:hover": {
			color: "var(--text-primary)",
			backgroundColor: "var(--bg-hover)",
			borderColor: "var(--border)",
		},
		".cm-panel.cm-search label": {
			display: "inline-flex",
			alignItems: "center",
			gap: "4px",
			color: "var(--text-muted)",
			whiteSpace: "nowrap",
		},
		'.cm-panel.cm-search input[type="checkbox"]': {
			accentColor: "var(--accent)",
		},
		'.cm-panel.cm-search [name="close"]': {
			position: "absolute",
			top: "8px",
			right: "8px",
			width: "28px",
			height: "28px",
			padding: "0",
			color: "var(--text-muted)",
			background: "transparent",
			border: "none",
			borderRadius: "4px",
			fontSize: "18px",
			lineHeight: "28px",
			cursor: "default",
		},
		'.cm-panel.cm-search [name="close"]:hover': {
			color: "var(--text-primary)",
			backgroundColor: "var(--bg-hover)",
		},
		".cm-searchMatch": {
			backgroundColor: "var(--editor-search-match-bg, var(--accent-subtle))",
			outline: "1px solid var(--accent-border)",
		},
		".cm-searchMatch.cm-searchMatch-selected": {
			backgroundColor: "var(--editor-search-match-active-bg, var(--bg-selected))",
			outline: "1px solid var(--accent)",
		},
	}
}

function typographyExtension(
	runtime: EditorRuntimeModules,
	fontSize: number,
	scrollMode: EditorScrollMode,
) {
	return runtime.view.EditorView.theme(buildEditorTypographyRules(fontSize, scrollMode))
}

function vimModeExtension(
	runtime: EditorRuntimeModules,
	enabled: boolean,
	vimCommands?: VimCommandProvider | null,
) {
	return enabled
		? [
				vimTableNavigationExtension(runtime),
				runtime.vim.vim(),
				runtime.view.drawSelection(),
				...(vimCommands ? [vimCommandExtension(runtime, vimCommands)] : []),
			]
		: []
}

function livePreviewModeExtension(
	runtime: EditorRuntimeModules,
	livePreview: boolean,
	resolveImageUrl?: (src: string, filePath: string) => string,
	filePath?: string,
	codeBlockEmbeds?: readonly CodeBlockEmbedDefinition[],
	lineEmbeds?: readonly LineEmbedDefinition[],
): EditorRuntimeExtension {
	return livePreview
		? [
				livePreviewExtension(runtime, resolveImageUrl, filePath, codeBlockEmbeds, lineEmbeds),
				tableSelectionExtension(runtime),
				tableAffordancesExtension(runtime),
				tableResizeExtension(runtime),
			]
		: []
}

export interface BaseExtensionsOptions {
	livePreview?: boolean
	resolveImageUrl?: (src: string, filePath: string) => string
	filePath?: string
	codeBlockEmbeds?: readonly CodeBlockEmbedDefinition[]
	lineEmbeds?: readonly LineEmbedDefinition[]
	scrollMode?: EditorScrollMode
	vimCommands?: VimCommandProvider | null
	commandExecutor?: MarkdownCommandExecutor | null
}

export interface PluginEditorContributions {
	extensions?: EditorRuntimeExtension
	foldProviders?: readonly EditorFoldProvider[]
}

export function baseExtensions(
	runtime: EditorRuntimeModules,
	config: EditorConfig = DEFAULT_EDITOR_CONFIG,
	{
		livePreview = true,
		resolveImageUrl,
		filePath,
		codeBlockEmbeds,
		lineEmbeds,
		scrollMode = "internal",
		vimCommands,
		commandExecutor,
	}: BaseExtensionsOptions = {},
) {
	const compartments = getEditorCompartments(runtime)
	return [
		compartments.vim.of(vimModeExtension(runtime, config.vimMode ?? false, vimCommands)),
		compartments.filePath.of(editorFilePathExtension(runtime, filePath)),
		runtime.commands.history(),
		runtime.view.dropCursor(),
		runtime.language.indentOnInput(),
		runtime.language.bracketMatching(),
		runtime.autocomplete.closeBrackets(),
		runtime.search.search({ top: true }),
		runtime.view.highlightActiveLine(),
		runtime.state.EditorState.allowMultipleSelections.of(true),
		tableEditingExtension(runtime),
		defaultMarkdownKeymapExtension(runtime, commandExecutor),
		runtime.view.keymap.of([
			runtime.commands.indentWithTab,
			...runtime.commands.defaultKeymap,
			...runtime.commands.historyKeymap,
			...runtime.search.searchKeymap,
		]),
		buildHighlightStyle(runtime),
		compartments.livePreview.of(
			livePreviewModeExtension(
				runtime,
				livePreview,
				resolveImageUrl,
				filePath,
				codeBlockEmbeds,
				lineEmbeds,
			),
		),
		runtime.langMarkdown.markdown({
			base: runtime.langMarkdown.markdownLanguage,
			codeLanguages: createCodeLanguages(runtime),
			extensions: runtime.lezerMarkdown.GFM,
		}),
		compartments.typography.of(typographyExtension(runtime, config.fontSize, scrollMode)),
		compartments.lineWrapping.of(config.wordWrap ? runtime.view.EditorView.lineWrapping : []),
		compartments.indent.of(
			runtime.language.indentUnit.of(config.useSpaces ? " ".repeat(config.tabSize) : "\t"),
		),
		compartments.lineNumbers.of(config.showLineNumbers ? runtime.view.lineNumbers() : []),
		compartments.folding.of(config.folding ? foldingExtension(runtime) : []),
		compartments.pluginFolding.of([]),
		compartments.pluginExtensions.of([]),
	]
}

export type ReconfigureEditorOptions = BaseExtensionsOptions

function normalizeReconfigureOptions(
	scrollModeOrOptions: EditorScrollMode | ReconfigureEditorOptions,
	vimCommands?: VimCommandProvider | null,
): ReconfigureEditorOptions {
	return typeof scrollModeOrOptions === "string"
		? { scrollMode: scrollModeOrOptions, vimCommands }
		: scrollModeOrOptions
}

export function reconfigureEditor(
	runtime: EditorRuntimeModules,
	view: EditorRuntimeView,
	config: EditorConfig,
	scrollModeOrOptions: EditorScrollMode | ReconfigureEditorOptions = "internal",
	vimCommands?: VimCommandProvider | null,
) {
	const {
		livePreview = true,
		resolveImageUrl,
		filePath,
		codeBlockEmbeds,
		lineEmbeds,
		scrollMode = "internal",
		vimCommands: normalizedVimCommands,
	} = normalizeReconfigureOptions(scrollModeOrOptions, vimCommands)
	const compartments = getEditorCompartments(runtime)
	view.dispatch({
		effects: [
			compartments.vim.reconfigure(
				vimModeExtension(runtime, config.vimMode ?? false, normalizedVimCommands),
			),
			compartments.livePreview.reconfigure(
				livePreviewModeExtension(
					runtime,
					livePreview,
					resolveImageUrl,
					filePath,
					codeBlockEmbeds,
					lineEmbeds,
				),
			),
			compartments.filePath.reconfigure(editorFilePathExtension(runtime, filePath)),
			compartments.typography.reconfigure(
				typographyExtension(runtime, config.fontSize, scrollMode),
			),
			compartments.lineWrapping.reconfigure(
				config.wordWrap ? runtime.view.EditorView.lineWrapping : [],
			),
			compartments.indent.reconfigure(
				runtime.language.indentUnit.of(config.useSpaces ? " ".repeat(config.tabSize) : "\t"),
			),
			compartments.lineNumbers.reconfigure(
				config.showLineNumbers ? runtime.view.lineNumbers() : [],
			),
			compartments.folding.reconfigure(config.folding ? foldingExtension(runtime) : []),
		],
	})
}

function normalizePluginEditorContributions(
	contributions: EditorRuntimeExtension | PluginEditorContributions,
): PluginEditorContributions {
	if (
		contributions &&
		typeof contributions === "object" &&
		("extensions" in contributions || "foldProviders" in contributions)
	) {
		return contributions as PluginEditorContributions
	}
	return { extensions: contributions as EditorRuntimeExtension }
}

export async function reconfigurePluginExtensions(
	view: EditorRuntimeView,
	contributions: EditorRuntimeExtension | PluginEditorContributions,
	isCurrent: () => boolean = () => true,
): Promise<void> {
	if (!isCurrent()) return
	const runtime = await loadEditorRuntime()
	if (isCurrent()) {
		const compartments = getEditorCompartments(runtime)
		const normalizedContributions = normalizePluginEditorContributions(contributions)
		view.dispatch({
			effects: [
				compartments.pluginExtensions.reconfigure(normalizedContributions.extensions ?? []),
				compartments.pluginFolding.reconfigure(
					pluginFoldingExtension(runtime, normalizedContributions.foldProviders ?? []),
				),
			],
		})
	}
}

export async function readonlyExtension() {
	const runtime = await loadEditorRuntime()
	return runtime.state.EditorState.readOnly.of(true)
}
