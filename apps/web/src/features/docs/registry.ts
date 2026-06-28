import { allDocs } from "content-collections"

export type DocPage = (typeof allDocs)[number]
export type DocHeading = DocPage["headings"][number]

export interface DocsNavigationGroup {
	section: string
	sectionOrder: number
	pages: DocPage[]
}

export interface DocsSearchEntry {
	id: string
	type: "page" | "heading"
	href: string
	title: string
	description: string
	section: string
	slug: string
	searchText: string
	depth?: DocHeading["depth"]
}

function byDocumentOrder(left: DocPage, right: DocPage) {
	return (
		left.sectionOrder - right.sectionOrder ||
		left.order - right.order ||
		left.title.localeCompare(right.title)
	)
}

function createDocs() {
	const docs = [...allDocs].sort(byDocumentOrder)
	const slugs = new Set<string>()

	for (const doc of docs) {
		if (slugs.has(doc.slug)) {
			throw new Error(`Duplicate docs slug: ${doc.slug}`)
		}
		slugs.add(doc.slug)
	}

	return docs
}

export const docs = createDocs()
export const defaultDoc = docs[0]

export const docsBySlug = new Map(docs.map((doc) => [doc.slug, doc]))

export const docsNavigation = docs.reduce<DocsNavigationGroup[]>((groups, doc) => {
	const existingGroup = groups.find((group) => group.section === doc.section)
	if (existingGroup) {
		existingGroup.pages.push(doc)
		return groups
	}

	groups.push({
		section: doc.section,
		sectionOrder: doc.sectionOrder,
		pages: [doc],
	})

	return groups.sort((left, right) => left.sectionOrder - right.sectionOrder)
}, [])

export const docsSearchIndex = docs.map((doc) => ({
	slug: doc.slug,
	href: doc.href,
	title: doc.title,
	description: doc.description,
	section: doc.section,
	searchText: doc.searchText,
	headings: doc.headings,
}))

export const docsSearchEntries: DocsSearchEntry[] = docs.flatMap((doc) => [
	{
		id: `page:${doc.slug}`,
		type: "page",
		href: doc.href,
		title: doc.title,
		description: doc.description,
		section: doc.section,
		slug: doc.slug,
		searchText: [doc.title, doc.description, doc.section].join(" ").toLowerCase(),
	},
	...doc.headings.map((heading) => ({
		id: `heading:${doc.slug}#${heading.id}`,
		type: "heading" as const,
		href: `${doc.href}#${heading.id}`,
		title: heading.text,
		description: doc.title,
		section: doc.section,
		slug: doc.slug,
		depth: heading.depth,
		searchText: [heading.text, doc.title, doc.description, doc.section].join(" ").toLowerCase(),
	})),
])

export function getDocBySlug(slug: string | undefined) {
	if (!slug) return defaultDoc
	return docsBySlug.get(slug)
}

export function searchDocs(query: string) {
	const normalizedQuery = query.trim().toLowerCase()
	if (!normalizedQuery) return docs
	return docs.filter((doc) => doc.searchText.includes(normalizedQuery))
}
