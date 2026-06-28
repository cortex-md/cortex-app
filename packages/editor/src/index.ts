import "./markdown.css"

export {
	type CalloutTypeDefinition,
	getCalloutRegistryVersion,
	getCalloutTypes,
	subscribeCalloutTypes,
} from "@cortex/renderer"
export { type ClipboardImageHandler, clipboardImageExtension } from "./clipboardImage"
export { EditorView } from "./EditorView"
export {
	type BaseExtensionsOptions,
	baseExtensions,
	DEFAULT_EDITOR_CONFIG,
	type PluginEditorContributions,
	readonlyExtension,
	reconfigureEditor,
	reconfigurePluginExtensions,
} from "./extensions"
export {
	type EditorFoldContext,
	type EditorFoldProvider,
	type EditorFoldRange,
	editorFilePathExtension,
	foldingExtension,
	pluginFoldingExtension,
} from "./folding"
export {
	foldAllRanges,
	toggleFoldAtSelection,
	unfoldAllRanges,
	unfoldCurrentFold,
} from "./foldingCommands"
export { buildHighlightStyle } from "./highlight"
export { getLanguageSupport } from "./languages"
export { livePreviewExtension } from "./livePreview"
export {
	addTableColumnEnd,
	addTableColumnLeft,
	addTableColumnRight,
	addTableRowAbove,
	addTableRowBelow,
	addTableRowEnd,
	alignTableColumnCenter,
	alignTableColumnLeft,
	alignTableColumnRight,
	clearTableCell,
	clearTableSelection,
	copyLine,
	copyTableColumnTsv,
	copyTableMarkdown,
	copyTableRowTsv,
	copyTableSelectionTsv,
	copyTableTsv,
	deleteTable,
	deleteTableColumn,
	deleteTableRow,
	duplicateLine,
	duplicateTableColumn,
	duplicateTableRow,
	hasTableCellSelection,
	hasTableVisualSelection,
	insertCallout,
	insertCodeBlock,
	insertImage,
	insertLink,
	insertTable,
	isSelectionInsideTable,
	moveTableColumnLeft,
	moveTableColumnRight,
	moveTableRowDown,
	moveTableRowUp,
	removeParagraphFormatting,
	toggleBlockquote,
	toggleBold,
	toggleHeading,
	toggleInlineCode,
	toggleItalic,
	toggleOrderedList,
	toggleStrikethrough,
	toggleTaskList,
	toggleUnorderedList,
} from "./markdownCommands"
export {
	createMarkdownFormatBindings,
	createMarkdownFormatCommandEntries,
	createMarkdownSlashCommandItems,
	type MarkdownFormatCommandDefinition,
	type MarkdownFormatCommandId,
	type MarkdownFormatCommandRunner,
	markdownFormatCommandDefinitions,
	markdownFormatCommandIds,
} from "./markdownFormatCommands"
export {
	defaultMarkdownKeymapExtension,
	type FormatBinding,
	getMarkdownKeymapCompartment,
	type MarkdownCommandExecutor,
	reconfigureMarkdownKeymap,
} from "./markdownKeymap"
export { ReadingView } from "./ReadingView"
export { loadCodeMirrorCommunityPluginExternals, loadEditorRuntime } from "./runtime"
export { SideBySideView } from "./SideBySideView"
export { openFindPanel } from "./searchCommands"
export {
	type SlashCommandItem,
	type SlashCommandMenuPosition,
	type SlashCommandMenuState,
	slashCommandExtension,
} from "./slashCommands"
export type {
	CursorInfo,
	EditorCommand,
	EditorConfig,
	EditorExtensionFactory,
	EditorRuntimeModules,
	EditorRuntimeView,
	EditorScrollMode,
	VimCommandChoice,
	VimCommandProvider,
} from "./types"
export { vimCommandExtension } from "./vimCommands"
