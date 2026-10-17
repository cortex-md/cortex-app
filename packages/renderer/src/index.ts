import type { SanitizedMarkdownHtml } from "./types"

export {
	type CalloutTypeDefinition,
	type CalloutTypeRegistration,
	getCalloutIconPaths,
	getCalloutRegistryVersion,
	getCalloutStyleVariables,
	getCalloutTypes,
	type ParsedCallout,
	type ParsedCalloutMarker,
	parseCallout,
	parseCalloutMarker,
	registerCalloutType,
	resolveCalloutType,
	subscribeCalloutTypes,
} from "./callouts"
export { type FrontmatterField, parseFrontmatterFields } from "./frontmatter"
export { findInlineHighlights, type InlineHighlightRange } from "./inlineMarks"
export {
	getMarkdownInlineRegistrations,
	getMarkdownPreprocessorEntries,
	getMarkdownPreprocessors,
	getMarkdownProcessorEntries,
	getMarkdownProcessors,
	getMarkdownRegistryVersion,
	getMarkdownSemanticRegistrations,
	getMarkdownTextTransforms,
	hasMarkdownTextRegistrations,
	type MarkdownDiagnostic,
	type MarkdownInlineRegistration,
	type MarkdownInlineReplacement,
	type MarkdownNodeSelector,
	type MarkdownPortableNode,
	type MarkdownPreprocessorContext,
	type MarkdownPreprocessorRegistration,
	type MarkdownProcessorPhase,
	type MarkdownProcessorRegistration,
	type MarkdownSemanticContext,
	type MarkdownSemanticRegistration,
	type MarkdownSemanticSurface,
	type MarkdownSurface,
	type MarkdownTextTransform,
	type MarkdownUnifiedFile,
	type MarkdownUnifiedNode,
	type MarkdownUnifiedPlugin,
	type MarkdownUnifiedTransformer,
	registerMarkdownInline,
	registerMarkdownPreprocessor,
	registerMarkdownProcessor,
	registerMarkdownSemantic,
	subscribeMarkdownDiagnostics,
	subscribeMarkdownRegistry,
	validateMarkdownPreprocessorRegistration,
	validateMarkdownProcessorRegistration,
} from "./registry"
export type { Renderer, RendererOptions, SanitizedMarkdownHtml } from "./types"
export function sanitizeRenderedMarkdownHtml(html: SanitizedMarkdownHtml | ""): string {
	return html
}
export { type MarkdownUrlKind, sanitizeMarkdownUrl } from "./urlPolicy"
