export interface InlineHighlightRange {
	from: number
	to: number
	contentFrom: number
	contentTo: number
}

export function findInlineHighlights(text: string, offset = 0): InlineHighlightRange[] {
	const ranges: InlineHighlightRange[] = []
	let index = text.indexOf("==")
	while (index !== -1) {
		const contentFrom = index + 2
		const first = text[contentFrom]
		if (first === undefined || first === " " || first === "=" || text[index - 1] === "=") {
			index = text.indexOf("==", index + 1)
			continue
		}
		const close = text.indexOf("==", contentFrom + 1)
		if (close === -1) break
		if (text[close - 1] === " " || text[close + 2] === "=") {
			index = text.indexOf("==", close + 1)
			continue
		}
		ranges.push({
			from: offset + index,
			to: offset + close + 2,
			contentFrom: offset + contentFrom,
			contentTo: offset + close,
		})
		index = text.indexOf("==", close + 2)
	}
	return ranges
}
