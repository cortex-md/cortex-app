import type {
	MarkdownPreprocessorRegistration,
	MarkdownProcessorRegistration,
	MarkdownSurface,
} from "./registry"

declare const sanitizedMarkdownHtmlBrand: unique symbol

export type SanitizedMarkdownHtml = string & {
	readonly [sanitizedMarkdownHtmlBrand]: true
}

export interface RendererOptions {
	surface?: MarkdownSurface
	preprocessors?: MarkdownPreprocessorRegistration[]
	processors?: MarkdownProcessorRegistration[]
}

export interface Renderer {
	render: (markdown: string) => Promise<SanitizedMarkdownHtml>
}
