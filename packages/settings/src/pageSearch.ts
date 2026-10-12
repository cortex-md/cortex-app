import { normalizeSearchText } from "./settingsSearch"

export interface SearchableSettingsPage {
	key: string
	label: string
	title?: string
	description?: string
	group?: string
	keywords?: readonly string[]
}

export function filterSettingsPages<Page extends SearchableSettingsPage>(
	pages: readonly Page[],
	query: string,
): Page[] {
	const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean)
	if (terms.length === 0) return [...pages]
	return pages.filter((page) => {
		const haystack = normalizeSearchText(
			[page.label, page.title, page.description, page.group, ...(page.keywords ?? [])]
				.filter(Boolean)
				.join(" "),
		)
		return terms.every((term) => haystack.includes(term))
	})
}
