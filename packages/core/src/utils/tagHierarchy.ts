export interface TagTreeNode {
	tag: string
	name: string
	color: string | null
	count: number
	children: TagTreeNode[]
}

export interface TagTreeSource {
	tag: string
	color: string | null
	filePaths: readonly string[]
}

export function buildTagTree(entries: readonly TagTreeSource[]): TagTreeNode[] {
	const nodes = new Map<string, TagTreeNode & { files: Set<string> }>()
	const ensure = (tag: string): TagTreeNode & { files: Set<string> } => {
		const existing = nodes.get(tag)
		if (existing) return existing
		const node = {
			tag,
			name: tag.slice(tag.lastIndexOf("/") + 1),
			color: null,
			count: 0,
			children: [],
			files: new Set<string>(),
		}
		nodes.set(tag, node)
		return node
	}
	for (const entry of entries) {
		const segments = entry.tag.split("/").filter(Boolean)
		for (let depth = 1; depth <= segments.length; depth++) {
			const node = ensure(segments.slice(0, depth).join("/"))
			for (const filePath of entry.filePaths) node.files.add(filePath)
		}
		ensure(entry.tag).color = entry.color
	}
	const roots: TagTreeNode[] = []
	for (const node of nodes.values()) {
		node.count = node.files.size
		const parentTag = node.tag.includes("/") ? node.tag.slice(0, node.tag.lastIndexOf("/")) : null
		const parent = parentTag ? nodes.get(parentTag) : undefined
		if (parent) parent.children.push(node)
		else roots.push(node)
	}
	const sortNodes = (list: TagTreeNode[]) => {
		list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
		for (const node of list) {
			if (node.color === null) {
				node.color = nodes.get(node.tag.split("/")[0])?.color ?? null
			}
			sortNodes(node.children)
		}
	}
	sortNodes(roots)
	return roots.map(function strip(node): TagTreeNode {
		return {
			tag: node.tag,
			name: node.name,
			color: node.color,
			count: node.count,
			children: node.children.map(strip),
		}
	})
}

export interface TagPageNote {
	filePath: string
	modifiedAt: number | null
	tags: string[]
}

export interface TagPageModel {
	tag: string
	noteCount: number
	childTags: Array<{ tag: string; count: number }>
	recent: TagPageNote[]
	older: TagPageNote[]
}

const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

export function isTagOrDescendant(candidate: string, tag: string): boolean {
	return candidate === tag || candidate.startsWith(`${tag}/`)
}

export function getTagPageModel(
	tag: string,
	tagIndex: Readonly<Record<string, readonly string[]>>,
	fileTags: Readonly<Record<string, readonly string[]>>,
	modifiedTimes: ReadonlyMap<string, number>,
	options: { childTag?: string | null; now?: number } = {},
): TagPageModel {
	const now = options.now ?? Date.now()
	const scope = options.childTag ?? tag
	const childCounts = new Map<string, Set<string>>()
	const notes = new Set<string>()
	for (const [candidate, filePaths] of Object.entries(tagIndex)) {
		if (!isTagOrDescendant(candidate, tag)) continue
		if (candidate !== tag) {
			const childTag = `${tag}/${candidate.slice(tag.length + 1).split("/")[0]}`
			const set = childCounts.get(childTag) ?? new Set<string>()
			for (const filePath of filePaths) set.add(filePath)
			childCounts.set(childTag, set)
		}
		if (isTagOrDescendant(candidate, scope)) for (const filePath of filePaths) notes.add(filePath)
	}
	const rows = [...notes]
		.map((filePath) => ({
			filePath,
			modifiedAt: modifiedTimes.get(filePath) ?? null,
			tags: (fileTags[filePath] ?? []).filter((candidate) => candidate !== tag),
		}))
		.sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0))
	return {
		tag,
		noteCount: notes.size,
		childTags: [...childCounts.entries()]
			.map(([childTag, filePaths]) => ({ tag: childTag, count: filePaths.size }))
			.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
		recent: rows.filter(
			(row) => row.modifiedAt !== null && now - row.modifiedAt <= RECENT_WINDOW_MS,
		),
		older: rows.filter((row) => row.modifiedAt === null || now - row.modifiedAt > RECENT_WINDOW_MS),
	}
}
