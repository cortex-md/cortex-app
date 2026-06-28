import type Fuse from "fuse.js"
import type { CategorizedIconGroup, IconData, VirtualIconItem } from "./icon-picker-types"

export function filterIconData(
	icons: IconData[],
	fuseInstance: Fuse<IconData>,
	search: string,
): IconData[] {
	if (search.trim() === "") return icons
	return fuseInstance.search(search.toLowerCase().trim()).map((result) => result.item)
}

export function groupIconData(
	icons: IconData[],
	categorized: boolean,
	search: string,
): CategorizedIconGroup[] {
	if (!categorized || search.trim() !== "") {
		return [{ name: "All Icons", icons }]
	}

	const categories = new Map<string, IconData[]>()

	for (const icon of icons) {
		if (icon.categories && icon.categories.length > 0) {
			for (const category of icon.categories) {
				if (!categories.has(category)) categories.set(category, [])
				categories.get(category)!.push(icon)
			}
		} else {
			const category = "Other"
			if (!categories.has(category)) categories.set(category, [])
			categories.get(category)!.push(icon)
		}
	}

	return Array.from(categories.entries())
		.map(([name, icons]) => ({ name, icons }))
		.sort((a, b) => a.name.localeCompare(b.name))
}

export function createVirtualIconItems(groups: CategorizedIconGroup[]): VirtualIconItem[] {
	const items: VirtualIconItem[] = []

	groups.forEach((group, categoryIndex) => {
		items.push({ type: "category", categoryIndex })

		for (let index = 0; index < group.icons.length; index += 5) {
			items.push({
				type: "row",
				categoryIndex,
				rowIndex: index / 5,
				icons: group.icons.slice(index, index + 5),
			})
		}
	})

	return items
}

export function createCategoryIndices(
	items: VirtualIconItem[],
	groups: CategorizedIconGroup[],
): Record<string, number> {
	const indices: Record<string, number> = {}

	items.forEach((item, index) => {
		if (item.type === "category") {
			indices[groups[item.categoryIndex].name] = index
		}
	})

	return indices
}
