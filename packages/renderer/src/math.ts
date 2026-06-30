export type { RenderMathExpressionInput, RenderMathExpressionResult } from "./mathRender"
export {
	containsMarkdownMath,
	findBlockMath,
	type MarkdownMathDisplayMode,
	type MarkdownMathToken,
	normalizeMathDelimiters,
	scanInlineMath,
} from "./mathSyntax"

export async function renderMathExpression(
	input: import("./mathRender").RenderMathExpressionInput,
) {
	const { renderMathExpression: render } = await import("./mathRender")
	return render(input)
}
