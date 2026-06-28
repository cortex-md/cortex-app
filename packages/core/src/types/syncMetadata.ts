export interface SyncPluginEntry {
	id: string
	name: string
	version: string
	author: string
	source: "bundled" | "community"
	repositoryUrl?: string
}

export interface SyncPluginsManifest {
	version: number
	plugins: SyncPluginEntry[]
}

export interface SyncThemeEntry {
	id: string
	displayName: string
	author: string
	version: string
	source: "community"
	repositoryUrl?: string
}

export interface SyncThemesManifest {
	version: number
	themes: SyncThemeEntry[]
}
