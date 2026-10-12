export type DiffOperation = "equal" | "insert" | "delete"

export interface DiffChunk<T> {
	operation: DiffOperation
	items: T[]
}

export interface DiffSegment {
	text: string
	changed: boolean
	start: number
}

export type DiffLineKind = "context" | "add" | "del"

type DiffRowContent =
	| { type: "line"; kind: DiffLineKind; segments: DiffSegment[] }
	| { type: "gap"; count: number }

export type DiffRow = DiffRowContent & { id: number }

export interface WordChangeCount {
	added: number
	removed: number
}

const MAX_DIFF_COST = 4_000_000

function pushChunk<T>(chunks: DiffChunk<T>[], operation: DiffOperation, item: T): void {
	const last = chunks.at(-1)
	if (last?.operation === operation) last.items.push(item)
	else chunks.push({ operation, items: [item] })
}

function fallbackDiff<T>(left: readonly T[], right: readonly T[]): DiffChunk<T>[] {
	const chunks: DiffChunk<T>[] = []
	if (left.length > 0) chunks.push({ operation: "delete", items: [...left] })
	if (right.length > 0) chunks.push({ operation: "insert", items: [...right] })
	return chunks
}

export function diffSequences<T>(left: readonly T[], right: readonly T[]): DiffChunk<T>[] {
	const leftLength = left.length
	const rightLength = right.length
	const max = leftLength + rightLength
	if (max === 0) return []
	const offset = max + 1
	const frontier = new Int32Array(2 * max + 3)
	const trace: Int32Array[] = []
	let solved = false
	for (let distance = 0; distance <= max && !solved; distance++) {
		if ((distance + 1) * (2 * max + 3) > MAX_DIFF_COST) return fallbackDiff(left, right)
		trace.push(frontier.slice())
		for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
			const moveDown =
				diagonal === -distance ||
				(diagonal !== distance &&
					(frontier[offset + diagonal - 1] ?? 0) < (frontier[offset + diagonal + 1] ?? 0))
			let x = moveDown
				? (frontier[offset + diagonal + 1] ?? 0)
				: (frontier[offset + diagonal - 1] ?? 0) + 1
			let y = x - diagonal
			while (x < leftLength && y < rightLength && left[x] === right[y]) {
				x++
				y++
			}
			frontier[offset + diagonal] = x
			if (x >= leftLength && y >= rightLength) {
				solved = true
				break
			}
		}
	}

	const steps: { operation: DiffOperation; item: T }[] = []
	let x = leftLength
	let y = rightLength
	for (let distance = trace.length - 1; distance >= 0; distance--) {
		const snapshot = trace[distance] as Int32Array
		const diagonal = x - y
		const moveDown =
			diagonal === -distance ||
			(diagonal !== distance &&
				(snapshot[offset + diagonal - 1] ?? 0) < (snapshot[offset + diagonal + 1] ?? 0))
		const previousDiagonal = moveDown ? diagonal + 1 : diagonal - 1
		const previousX = distance === 0 ? 0 : (snapshot[offset + previousDiagonal] ?? 0)
		const previousY = distance === 0 ? 0 : previousX - previousDiagonal
		while (x > previousX && y > previousY) {
			x--
			y--
			steps.push({ operation: "equal", item: left[x] as T })
		}
		if (distance > 0) {
			if (x === previousX) steps.push({ operation: "insert", item: right[previousY] as T })
			else steps.push({ operation: "delete", item: left[previousX] as T })
		}
		x = previousX
		y = previousY
	}

	const chunks: DiffChunk<T>[] = []
	for (let index = steps.length - 1; index >= 0; index--) {
		const step = steps[index]
		if (step) pushChunk(chunks, step.operation, step.item)
	}
	return chunks
}

function splitLines(text: string): string[] {
	if (!text) return []
	return text.replace(/\r\n/g, "\n").split("\n")
}

function tokenizeWords(text: string): string[] {
	return text.match(/\s+|[^\s]+/g) ?? []
}

function countWords(text: string): number {
	return text.match(/[^\s]+/g)?.length ?? 0
}

function wordSegments(
	before: string,
	after: string,
): { removed: DiffSegment[]; added: DiffSegment[] } {
	const removed: DiffSegment[] = []
	const added: DiffSegment[] = []
	const pushSegment = (segments: DiffSegment[], text: string, changed: boolean) => {
		const last = segments.at(-1)
		if (last && last.changed === changed) last.text += text
		else segments.push({ text, changed, start: last ? last.start + last.text.length : 0 })
	}
	for (const chunk of diffSequences(tokenizeWords(before), tokenizeWords(after))) {
		const text = chunk.items.join("")
		if (chunk.operation === "equal") {
			pushSegment(removed, text, false)
			pushSegment(added, text, false)
		} else if (chunk.operation === "delete") pushSegment(removed, text, true)
		else pushSegment(added, text, true)
	}
	return { removed, added }
}

const PAIR_SIMILARITY = 0.4

function normalizedWords(line: string): string[] {
	return line.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
}

function lineSimilarity(left: string, right: string): number {
	const leftWords = normalizedWords(left)
	const rightWords = new Set(normalizedWords(right))
	if (leftWords.length === 0 || rightWords.size === 0) return 0
	const shared = leftWords.filter((word) => rightWords.has(word)).length
	return shared / Math.max(leftWords.length, rightWords.size)
}

function pairChangedLines(
	removedLines: readonly string[],
	addedLines: readonly string[],
): DiffRowContent[] {
	const rows: DiffRowContent[] = []
	let addedIndex = 0
	for (const removedLine of removedLines) {
		let match = -1
		for (let candidate = addedIndex; candidate < addedLines.length; candidate++) {
			if (lineSimilarity(removedLine, addedLines[candidate] ?? "") >= PAIR_SIMILARITY) {
				match = candidate
				break
			}
		}
		if (match === -1) {
			rows.push(plainLine("del", removedLine, false))
			continue
		}
		for (; addedIndex < match; addedIndex++) {
			rows.push(plainLine("add", addedLines[addedIndex] ?? "", false))
		}
		const { removed, added } = wordSegments(removedLine, addedLines[match] ?? "")
		rows.push({ type: "line", kind: "del", segments: removed })
		rows.push({ type: "line", kind: "add", segments: added })
		addedIndex = match + 1
	}
	for (; addedIndex < addedLines.length; addedIndex++) {
		rows.push(plainLine("add", addedLines[addedIndex] ?? "", false))
	}
	return rows
}

function plainLine(kind: DiffLineKind, text: string, changed: boolean): DiffRowContent {
	return { type: "line", kind, segments: [{ text, changed, start: 0 }] }
}

function isBlankContext(row: DiffRowContent): boolean {
	return (
		row.type === "line" &&
		row.kind === "context" &&
		row.segments.every((segment) => !segment.text.trim())
	)
}

function foldBlankContext(rows: readonly DiffRowContent[]): DiffRowContent[] {
	const folded: DiffRowContent[] = []
	for (const row of rows) {
		const hidden = isBlankContext(row) ? 1 : row.type === "gap" ? row.count : 0
		const last = folded.at(-1)
		if (hidden > 0 && last?.type === "gap") {
			last.count += hidden
			continue
		}
		folded.push(isBlankContext(row) ? { type: "gap", count: 1 } : row)
	}
	return folded
}

export function buildDiffRows(before: string, after: string, context = 1): DiffRow[] {
	const chunks = diffSequences(splitLines(before), splitLines(after))
	const rows: DiffRowContent[] = []
	for (let index = 0; index < chunks.length; index++) {
		const chunk = chunks[index]
		if (!chunk) continue
		if (chunk.operation === "equal") {
			const hasPrevious = index > 0
			const hasNext = index < chunks.length - 1
			const leading = hasPrevious ? chunk.items.slice(0, context) : []
			const trailing = hasNext ? chunk.items.slice(-context) : []
			const hidden = chunk.items.length - leading.length - trailing.length
			if (hidden <= 0) {
				for (const line of chunk.items) rows.push(plainLine("context", line, false))
				continue
			}
			for (const line of leading) rows.push(plainLine("context", line, false))
			rows.push({ type: "gap", count: hidden })
			for (const line of trailing) rows.push(plainLine("context", line, false))
			continue
		}
		const next = chunks[index + 1]
		if (chunk.operation === "delete" && next?.operation === "insert") {
			rows.push(...pairChangedLines(chunk.items, next.items))
			index++
			continue
		}
		const kind = chunk.operation === "insert" ? "add" : "del"
		for (const line of chunk.items) rows.push(plainLine(kind, line, false))
	}
	return foldBlankContext(rows).map((row, id) => ({ ...row, id }))
}

export function countWordChanges(before: string, after: string): WordChangeCount {
	const result: WordChangeCount = { added: 0, removed: 0 }
	const lineChunks = diffSequences(splitLines(before), splitLines(after))
	for (let index = 0; index < lineChunks.length; index++) {
		const chunk = lineChunks[index]
		if (!chunk || chunk.operation === "equal") continue
		const next = lineChunks[index + 1]
		if (chunk.operation === "delete" && next?.operation === "insert") {
			const wordChunks = diffSequences(
				tokenizeWords(chunk.items.join("\n")),
				tokenizeWords(next.items.join("\n")),
			)
			for (const wordChunk of wordChunks) {
				if (wordChunk.operation === "equal") continue
				const words = countWords(wordChunk.items.join(""))
				if (wordChunk.operation === "insert") result.added += words
				else result.removed += words
			}
			index++
			continue
		}
		const words = countWords(chunk.items.join("\n"))
		if (chunk.operation === "insert") result.added += words
		else result.removed += words
	}
	return result
}
