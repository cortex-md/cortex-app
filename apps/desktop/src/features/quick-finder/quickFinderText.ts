import { getSearchTerms, type SearchMatchRange } from "@cortex/search"

export function findTitleRanges(title: string, query: string): SearchMatchRange[] {
	const normalizedTitle = title.toLowerCase()
	const ranges: [number, number][] = []
	for (const term of getSearchTerms(query)) {
		const start = normalizedTitle.indexOf(term)
		if (start !== -1) ranges.push([start, start + term.length])
	}
	ranges.sort((left, right) => left[0] - right[0])
	const merged: [number, number][] = []
	for (const range of ranges) {
		const last = merged.at(-1)
		if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
		else merged.push(range)
	}
	return merged
}

export function formatFolderLabel(folder: string): string {
	return folder.split("/").filter(Boolean).join(" / ")
}
