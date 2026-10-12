export interface CollabUserColor {
	color: string
	colorLight: string
}

const COLLAB_USER_COLORS = [
	"#e5484d",
	"#f76b15",
	"#d6a000",
	"#30a46c",
	"#12a594",
	"#0090ff",
	"#3e63dd",
	"#8e4ec6",
	"#d6409f",
	"#7c8a2f",
] as const

export function hashString32(value: string): number {
	let hash = 0x811c9dc5
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index)
		hash = Math.imul(hash, 0x01000193)
	}
	return hash >>> 0
}

export function collabUserColor(userId: string): CollabUserColor {
	const color = COLLAB_USER_COLORS[hashString32(userId) % COLLAB_USER_COLORS.length]
	return { color, colorLight: `${color}33` }
}
