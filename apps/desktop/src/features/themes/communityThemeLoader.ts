import type { FileEntry } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import {
	type CommunityThemeManifest,
	getThemeManager,
	parseCommunityThemeManifest,
	type ThemeFamily,
} from "@cortex/theme"

interface CommunityThemeStylesheet {
	themeName: string
	path: string
	loaded: boolean
	loadPromise?: Promise<void>
}

const communityThemeStylesheets = new Map<string, CommunityThemeStylesheet>()

export async function loadCommunityThemes(themesDir: string): Promise<void> {
	const platform = getPlatform()
	const themeManager = getThemeManager()

	let dirs: FileEntry[]
	try {
		dirs = await platform.fs.listDir(themesDir)
	} catch {
		return
	}

	for (const dir of dirs.filter((e) => e.isDir)) {
		const manifestPath = `${themesDir}/${dir.name}/manifest.json`

		let raw: string
		try {
			raw = await platform.fs.readFile(manifestPath)
		} catch {
			continue
		}

		let manifest: CommunityThemeManifest
		try {
			manifest = parseCommunityThemeManifest(raw)
		} catch {
			continue
		}

		const family: ThemeFamily = {
			name: manifest.name,
			displayName: manifest.displayName,
			darkTheme: `${manifest.name}-dark`,
			lightTheme: `${manifest.name}-light`,
		}

		communityThemeStylesheets.set(family.darkTheme, {
			themeName: family.darkTheme,
			path: `${themesDir}/${dir.name}/${manifest.colorschemes.dark}`,
			loaded: false,
		})
		communityThemeStylesheets.set(family.lightTheme, {
			themeName: family.lightTheme,
			path: `${themesDir}/${dir.name}/${manifest.colorschemes.light}`,
			loaded: false,
		})

		themeManager.registerCommunityFamily(family)
	}
}

export async function ensureCommunityThemeCssLoaded(themeName: string): Promise<void> {
	const stylesheet = communityThemeStylesheets.get(themeName)
	if (!stylesheet || stylesheet.loaded) return
	if (stylesheet.loadPromise) return stylesheet.loadPromise

	stylesheet.loadPromise = (async () => {
		try {
			const css = await getPlatform().fs.readFile(stylesheet.path)
			getThemeManager().injectCSS(css, stylesheet.themeName)
			stylesheet.loaded = true
		} catch (error) {
			stylesheet.loadPromise = undefined
			throw error
		}
	})()

	return stylesheet.loadPromise
}

export async function reloadCommunityThemes(themesDir: string): Promise<void> {
	unloadCommunityThemes()
	await loadCommunityThemes(themesDir)
}

export function unloadCommunityThemes(): void {
	const themeManager = getThemeManager()
	communityThemeStylesheets.clear()
	for (const family of themeManager.getThemeFamilies()) {
		if (family.name !== "default") {
			themeManager.unregisterTheme(family.name)
		}
	}
}
