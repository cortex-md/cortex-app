import type { MarkdownMathDisplayMode } from "./mathSyntax"

export interface RenderMathExpressionInput {
	source: string
	displayMode: MarkdownMathDisplayMode
}

export interface RenderMathExpressionResult {
	html: string
	status: "success" | "error"
	message?: string
}

interface KatexModule {
	default?: {
		renderToString: (source: string, options: Record<string, unknown>) => string
	}
	renderToString?: (source: string, options: Record<string, unknown>) => string
}

const maxCachedExpressions = 256
const renderCache = new Map<string, Promise<RenderMathExpressionResult>>()

function getCacheKey(input: RenderMathExpressionInput): string {
	return `${input.displayMode}:${input.source}`
}

function rememberRender(
	key: string,
	result: Promise<RenderMathExpressionResult>,
): Promise<RenderMathExpressionResult> {
	renderCache.set(key, result)
	if (renderCache.size > maxCachedExpressions) {
		const firstKey = renderCache.keys().next().value
		if (typeof firstKey === "string") renderCache.delete(firstKey)
	}
	return result
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;")
}

async function loadKatexRenderToString(): Promise<
	(source: string, options: Record<string, unknown>) => string
> {
	const module = (await import("katex")) as KatexModule
	const renderToString = module.default?.renderToString ?? module.renderToString
	if (typeof renderToString !== "function") {
		throw new Error("KaTeX renderer is unavailable")
	}
	return renderToString
}

async function renderMath(input: RenderMathExpressionInput): Promise<RenderMathExpressionResult> {
	try {
		const renderToString = await loadKatexRenderToString()
		return {
			status: "success",
			html: renderToString(input.source.trimEnd(), {
				displayMode: input.displayMode === "block",
				output: "htmlAndMathml",
				strict: "warn",
				throwOnError: false,
				trust: false,
			}),
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		return {
			status: "error",
			message,
			html: `<span class="katex-error" title="${escapeHtml(message)}">${escapeHtml(input.source)}</span>`,
		}
	}
}

export function renderMathExpression(
	input: RenderMathExpressionInput,
): Promise<RenderMathExpressionResult> {
	const key = getCacheKey(input)
	const cached = renderCache.get(key)
	if (cached) {
		renderCache.delete(key)
		renderCache.set(key, cached)
		return cached
	}
	return rememberRender(key, renderMath(input))
}
