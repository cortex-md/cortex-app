import type { CommentAnchor, CommentThread, ResolvedAnchorRange } from "./types"

const ANCHOR_CONTEXT_LENGTH = 32

export function createAnchor(body: string, from: number, to: number): CommentAnchor {
	const start = Math.max(0, Math.min(from, to))
	const end = Math.min(body.length, Math.max(from, to))
	return {
		quote: body.slice(start, end),
		prefix: body.slice(Math.max(0, start - ANCHOR_CONTEXT_LENGTH), start),
		suffix: body.slice(end, end + ANCHOR_CONTEXT_LENGTH),
		from: start,
		to: end,
	}
}

export function anchorAtRange(
	body: string,
	anchor: CommentAnchor,
	range: ResolvedAnchorRange,
): CommentAnchor {
	if (range.from === anchor.from && range.to === anchor.to) return anchor
	return createAnchor(body, range.from, range.to)
}

function sharedSuffixLength(left: string, right: string): number {
	let length = 0
	while (
		length < left.length &&
		length < right.length &&
		left[left.length - 1 - length] === right[right.length - 1 - length]
	) {
		length += 1
	}
	return length
}

function sharedPrefixLength(left: string, right: string): number {
	let length = 0
	while (length < left.length && length < right.length && left[length] === right[length]) {
		length += 1
	}
	return length
}

function scoreCandidate(body: string, anchor: CommentAnchor, start: number): number {
	const end = start + anchor.quote.length
	const prefix = body.slice(Math.max(0, start - anchor.prefix.length), start)
	const suffix = body.slice(end, end + anchor.suffix.length)
	const contextScore =
		sharedSuffixLength(prefix, anchor.prefix) + sharedPrefixLength(suffix, anchor.suffix)
	const distancePenalty = Math.abs(start - anchor.from) / Math.max(body.length, 1)
	return contextScore - distancePenalty
}

export function resolveAnchor(body: string, anchor: CommentAnchor): ResolvedAnchorRange | null {
	if (!anchor.quote) return null
	if (body.slice(anchor.from, anchor.to) === anchor.quote) {
		return { from: anchor.from, to: anchor.to }
	}
	let bestStart = -1
	let bestScore = Number.NEGATIVE_INFINITY
	let index = body.indexOf(anchor.quote)
	while (index !== -1) {
		const score = scoreCandidate(body, anchor, index)
		if (score > bestScore) {
			bestScore = score
			bestStart = index
		}
		index = body.indexOf(anchor.quote, index + 1)
	}
	if (bestStart === -1) return null
	return { from: bestStart, to: bestStart + anchor.quote.length }
}

export function resolveAnchors(
	body: string,
	threads: Iterable<CommentThread>,
): Map<string, ResolvedAnchorRange | null> {
	const ranges = new Map<string, ResolvedAnchorRange | null>()
	for (const thread of threads) ranges.set(thread.id, resolveAnchor(body, thread.anchor))
	return ranges
}
