export type SettingsSearchItemKind = "page" | "field" | "plugin" | "template"

export interface SettingsSearchItem {
	id: string
	pageKey: string
	kind: SettingsSearchItemKind
	label: string
	path: readonly string[]
	description?: string
	keywords?: readonly string[]
	fallbackId?: string
}

export interface SettingsSearchRange {
	start: number
	end: number
}

export interface SettingsSearchResult {
	item: SettingsSearchItem
	score: number
	labelRanges: SettingsSearchRange[]
}

interface NormalizedText {
	value: string
	sourceIndex: number[]
}

function normalizeChar(char: string): string {
	return char
		.toLowerCase()
		.normalize("NFKD")
		.replace(/\p{Diacritic}/gu, "")
}

export function normalizeSearchText(value: string): string {
	return normalizeChar(value)
}

function normalizeWithMap(value: string): NormalizedText {
	let normalized = ""
	const sourceIndex: number[] = []
	let index = 0
	for (const char of value) {
		const mapped = normalizeChar(char)
		for (let offset = 0; offset < mapped.length; offset++) sourceIndex.push(index)
		normalized += mapped
		index += char.length
	}
	sourceIndex.push(index)
	return { value: normalized, sourceIndex }
}

function isWordStart(text: string, index: number): boolean {
	return index === 0 || /[\s\-_/.›]/.test(text[index - 1] ?? "")
}

function scoreLabel(label: string, term: string): number {
	if (label === term) return 100
	if (label.startsWith(term)) return 80
	let index = label.indexOf(term)
	while (index !== -1) {
		if (isWordStart(label, index)) return 65
		index = label.indexOf(term, index + 1)
	}
	return label.includes(term) ? 50 : 0
}

function scoreTerm(item: SettingsSearchItem, label: string, term: string): number {
	const labelScore = scoreLabel(label, term)
	if (labelScore > 0) return labelScore
	if (item.keywords?.some((keyword) => normalizeSearchText(keyword).includes(term))) return 35
	if (item.path.some((segment) => normalizeSearchText(segment).includes(term))) return 25
	if (item.description && normalizeSearchText(item.description).includes(term)) return 15
	return 0
}

function findLabelRanges(label: NormalizedText, terms: string[]): SettingsSearchRange[] {
	const ranges: SettingsSearchRange[] = []
	for (const term of terms) {
		const index = label.value.indexOf(term)
		if (index === -1) continue
		ranges.push({
			start: label.sourceIndex[index] ?? 0,
			end: label.sourceIndex[index + term.length] ?? label.sourceIndex.at(-1) ?? 0,
		})
	}
	ranges.sort((a, b) => a.start - b.start)
	return ranges.reduce<SettingsSearchRange[]>((merged, range) => {
		const last = merged.at(-1)
		if (last && range.start <= last.end) last.end = Math.max(last.end, range.end)
		else merged.push({ ...range })
		return merged
	}, [])
}

export function searchSettings(
	items: readonly SettingsSearchItem[],
	query: string,
	limit = 40,
): SettingsSearchResult[] {
	const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean)
	if (terms.length === 0) return []
	const results: (SettingsSearchResult & { order: number })[] = []
	items.forEach((item, order) => {
		const label = normalizeWithMap(item.label)
		let score = 0
		for (const term of terms) {
			const termScore = scoreTerm(item, label.value, term)
			if (termScore === 0) return
			score += termScore
		}
		if (item.kind === "page") score += 5
		results.push({ item, score, labelRanges: findLabelRanges(label, terms), order })
	})
	return results
		.sort((a, b) => b.score - a.score || a.order - b.order)
		.slice(0, limit)
		.map(({ order: _order, ...result }) => result)
}
