export function getFileTreeItemId(path: string): string {
	let hash = 0
	for (const character of path) {
		hash = (hash << 5) - hash + character.charCodeAt(0)
		hash |= 0
	}
	return `file-tree-item-${Math.abs(hash)}`
}

export function getKeyboardMenuPosition(element: HTMLElement | null): { x: number; y: number } {
	if (!element) return { x: 0, y: 0 }
	const rect = element.getBoundingClientRect()
	return {
		x: rect.left + Math.min(32, rect.width / 2),
		y: rect.top + rect.height / 2,
	}
}
