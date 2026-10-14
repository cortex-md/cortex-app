export type RegistryKind = "plugin" | "theme"

export interface RegistryEntry {
	id: string
	name: string
	author: string
	authorUrl?: string
	description: string
	coverImageUrl: string
	repo: string
}

export interface RegistryDiscussion {
	number: number
	url: string
}

export interface RegistryItemStats {
	downloads?: number
	stars?: number
	votes?: number
	latest?: string
	releasedAt?: string
	discussion?: RegistryDiscussion
}

export interface RegistryStats {
	generatedAt: string | null
	plugins: Record<string, RegistryItemStats>
	themes: Record<string, RegistryItemStats>
}

export interface VerifiedEntry {
	kind: RegistryKind
	id: string
}

export interface BlockedEntry {
	kind: RegistryKind
	id: string
	reason: string
	versions: string[] | null
}

export interface RegistryManifest {
	displayName: string | null
	version: string | null
	minAppVersion: string | null
	icon: string | null
	capabilities: string[]
	colorschemes: { light: string | null; dark: string | null }
}

export interface ThemePalette {
	label: "Light" | "Dark"
	bg: string
	side: string
	text: string
	muted: string
	accent: string
	fill: string
	line: string
	tag: string
	tagText: string
}
