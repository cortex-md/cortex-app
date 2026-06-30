export type MarkdownMathDisplayMode = "inline" | "block"

export interface MarkdownMathToken {
	from: number
	to: number
	contentFrom: number
	contentTo: number
	source: string
	content: string
	displayMode: MarkdownMathDisplayMode
	delimiter: "$" | "$$" | "\\(" | "\\["
	openingFrom: number
	openingTo: number
	closingFrom: number
	closingTo: number
}

interface InlineDelimiterMatch {
	from: number
	to: number
	openingLength: number
	closingLength: number
	delimiter: "$" | "\\("
}

const blockMathCandidatePattern = /(?:^|\n)\s{0,3}(?:\$\$|\\\[)(?:\s|$)/
const inlineMathCandidatePattern = /(?:^|[^\\])(?:\$|\\\()/
const fencedCodePattern = /^ {0,3}(`{3,}|~{3,})/

function isEscaped(value: string, index: number): boolean {
	let slashCount = 0
	for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor--) slashCount++
	return slashCount % 2 === 1
}

function isInlineCodePosition(value: string, index: number): boolean {
	let inCode = false
	for (let cursor = 0; cursor < index; cursor++) {
		if (value[cursor] !== "`" || isEscaped(value, cursor)) continue
		let tickCount = 1
		while (value[cursor + tickCount] === "`") tickCount++
		inCode = !inCode
		cursor += tickCount - 1
	}
	return inCode
}

function canOpenDollar(value: string, index: number): boolean {
	const previous = value[index - 1] ?? ""
	const next = value[index + 1] ?? ""
	if (!next || next === "$" || /\s|\d/.test(next)) return false
	if (previous === "$" || /[\w)]/.test(previous)) return false
	return true
}

function canCloseDollar(value: string, index: number): boolean {
	const previous = value[index - 1] ?? ""
	const next = value[index + 1] ?? ""
	if (!previous || /\s/.test(previous)) return false
	if (next === "$" || /\d/.test(next)) return false
	return true
}

function findInlineDelimiter(value: string, startIndex: number): InlineDelimiterMatch | null {
	for (let index = startIndex; index < value.length; index++) {
		const character = value[index]
		if (character === "`") {
			index++
			while (index < value.length && value[index] !== "`") index++
			continue
		}
		if (character === "$") {
			if (isEscaped(value, index) || !canOpenDollar(value, index)) continue
			for (let closeIndex = index + 1; closeIndex < value.length; closeIndex++) {
				if (value[closeIndex] !== "$" || isEscaped(value, closeIndex)) continue
				if (!canCloseDollar(value, closeIndex)) continue
				return {
					from: index,
					to: closeIndex + 1,
					openingLength: 1,
					closingLength: 1,
					delimiter: "$",
				}
			}
			continue
		}
		if (character === "\\" && value[index + 1] === "(" && !isEscaped(value, index)) {
			for (let closeIndex = index + 2; closeIndex < value.length - 1; closeIndex++) {
				if (value[closeIndex] !== "\\" || value[closeIndex + 1] !== ")") continue
				if (isEscaped(value, closeIndex)) continue
				return {
					from: index,
					to: closeIndex + 2,
					openingLength: 2,
					closingLength: 2,
					delimiter: "\\(",
				}
			}
		}
	}
	return null
}

export function scanInlineMath(value: string, offset = 0): MarkdownMathToken[] {
	const tokens: MarkdownMathToken[] = []
	let cursor = 0
	while (cursor < value.length) {
		const match = findInlineDelimiter(value, cursor)
		if (!match) break
		const contentFrom = match.from + match.openingLength
		const contentTo = match.to - match.closingLength
		const content = value.slice(contentFrom, contentTo)
		if (content.trim().length > 0 && !isInlineCodePosition(value, match.from)) {
			tokens.push({
				from: offset + match.from,
				to: offset + match.to,
				contentFrom: offset + contentFrom,
				contentTo: offset + contentTo,
				source: value.slice(match.from, match.to),
				content,
				displayMode: "inline",
				delimiter: match.delimiter,
				openingFrom: offset + match.from,
				openingTo: offset + contentFrom,
				closingFrom: offset + contentTo,
				closingTo: offset + match.to,
			})
		}
		cursor = Math.max(match.to, cursor + 1)
	}
	return tokens
}

function findClosingBlockLine(
	lines: { from: number; to: number; text: string }[],
	startLineIndex: number,
	delimiter: "$$" | "\\[",
): number {
	const closingDelimiter = delimiter === "$$" ? "$$" : "\\]"
	for (let index = startLineIndex + 1; index < lines.length; index++) {
		if (lines[index].text.trim() === closingDelimiter) return index
	}
	return -1
}

function splitMarkdownLines(markdown: string): { from: number; to: number; text: string }[] {
	const lines: { from: number; to: number; text: string }[] = []
	let from = 0
	while (from <= markdown.length) {
		const newline = markdown.indexOf("\n", from)
		const to = newline === -1 ? markdown.length : newline
		lines.push({ from, to, text: markdown.slice(from, to) })
		if (newline === -1) break
		from = newline + 1
	}
	return lines
}

export function findBlockMath(markdown: string): MarkdownMathToken[] {
	const tokens: MarkdownMathToken[] = []
	const lines = splitMarkdownLines(markdown)
	let inFence: string | null = null

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex]
		const fence = line.text.match(fencedCodePattern)?.[1]
		if (fence) {
			if (inFence === null) inFence = fence[0]
			else if (fence[0] === inFence) inFence = null
			continue
		}
		if (inFence !== null) continue

		const trimmed = line.text.trim()
		if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 4) {
			const openingFrom = line.from + line.text.indexOf("$$")
			const closingFrom = line.from + line.text.lastIndexOf("$$")
			const contentFrom = openingFrom + 2
			const contentTo = closingFrom
			tokens.push({
				from: line.from,
				to: line.to,
				contentFrom,
				contentTo,
				source: markdown.slice(line.from, line.to),
				content: markdown.slice(contentFrom, contentTo),
				displayMode: "block",
				delimiter: "$$",
				openingFrom,
				openingTo: contentFrom,
				closingFrom,
				closingTo: closingFrom + 2,
			})
			continue
		}

		const delimiter = trimmed === "$$" ? "$$" : trimmed === "\\[" ? "\\[" : null
		if (!delimiter) continue
		const closingLineIndex = findClosingBlockLine(lines, lineIndex, delimiter)
		if (closingLineIndex === -1) continue

		const closingDelimiter = delimiter === "$$" ? "$$" : "\\]"
		const closingLine = lines[closingLineIndex]
		const openingFrom = line.from + line.text.indexOf(delimiter)
		const closingFrom = closingLine.from + closingLine.text.indexOf(closingDelimiter)
		const contentFrom = line.to + 1
		const contentTo = closingLine.from
		tokens.push({
			from: line.from,
			to: closingLine.to,
			contentFrom,
			contentTo,
			source: markdown.slice(line.from, closingLine.to),
			content: markdown.slice(contentFrom, contentTo).trimEnd(),
			displayMode: "block",
			delimiter,
			openingFrom,
			openingTo: openingFrom + delimiter.length,
			closingFrom,
			closingTo: closingFrom + closingDelimiter.length,
		})
		lineIndex = closingLineIndex
	}

	return tokens
}

export function containsMarkdownMath(markdown: string): boolean {
	if (blockMathCandidatePattern.test(markdown)) return findBlockMath(markdown).length > 0
	if (!inlineMathCandidatePattern.test(markdown)) return false
	let inFence: string | null = null
	for (const line of splitMarkdownLines(markdown)) {
		const fence = line.text.match(fencedCodePattern)?.[1]
		if (fence) {
			if (inFence === null) inFence = fence[0]
			else if (fence[0] === inFence) inFence = null
			continue
		}
		if (inFence === null && scanInlineMath(line.text).length > 0) return true
	}
	return false
}

function normalizeInlineBackslashMath(line: string): string {
	let result = ""
	let cursor = 0
	for (const token of scanInlineMath(line)) {
		if (token.delimiter !== "\\(") continue
		result += line.slice(cursor, token.from)
		result += `$${token.content}$`
		cursor = token.to
	}
	return cursor === 0 ? line : result + line.slice(cursor)
}

export function normalizeMathDelimiters(markdown: string): string {
	const lines = splitMarkdownLines(markdown)
	let inFence: string | null = null
	let changed = false
	const nextLines = lines.map((line) => {
		const fence = line.text.match(fencedCodePattern)?.[1]
		if (fence) {
			if (inFence === null) inFence = fence[0]
			else if (fence[0] === inFence) inFence = null
			return line.text
		}
		if (inFence !== null) return line.text

		const trimmed = line.text.trim()
		if (trimmed === "\\[") {
			changed = true
			return line.text.replace("\\[", () => "$$")
		}
		if (trimmed === "\\]") {
			changed = true
			return line.text.replace("\\]", () => "$$")
		}
		const normalized = normalizeInlineBackslashMath(line.text)
		if (normalized !== line.text) changed = true
		return normalized
	})

	return changed ? nextLines.join("\n") : markdown
}
