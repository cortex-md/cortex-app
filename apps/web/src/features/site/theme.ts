export type SiteTheme = "light" | "dark"

export const siteThemeStorageKey = "cortex-theme"

const themeColors: Record<SiteTheme, string> = {
	light: "#fbfbfc",
	dark: "#10100d",
}

export function isSiteTheme(value: unknown): value is SiteTheme {
	return value === "light" || value === "dark"
}

function getSystemTheme(): SiteTheme {
	if (typeof window === "undefined" || !window.matchMedia) return "light"
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function getStoredSiteTheme(): SiteTheme | undefined {
	if (typeof window === "undefined") return undefined

	try {
		const stored = window.localStorage.getItem(siteThemeStorageKey)
		return isSiteTheme(stored) ? stored : undefined
	} catch {
		return undefined
	}
}

export function getCurrentSiteTheme(): SiteTheme {
	if (typeof document !== "undefined" && isSiteTheme(document.documentElement.dataset.theme)) {
		return document.documentElement.dataset.theme
	}

	return getStoredSiteTheme() ?? getSystemTheme()
}

export function applySiteTheme(theme: SiteTheme, persist = true) {
	if (typeof document === "undefined") return

	const root = document.documentElement
	root.dataset.theme = theme
	root.style.colorScheme = theme

	if (persist) {
		try {
			window.localStorage.setItem(siteThemeStorageKey, theme)
		} catch {
			// Storage can be unavailable in private or embedded contexts.
		}
	}

	for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
		if (!meta.media) meta.content = themeColors[theme]
	}

	window.dispatchEvent(new CustomEvent("cortex-theme-change", { detail: { theme } }))
}

export function getThemeInitScript() {
	return `(() => {
try {
  const key = ${JSON.stringify(siteThemeStorageKey)};
  const stored = window.localStorage.getItem(key);
  const theme = stored === "light" || stored === "dark"
    ? stored
    : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  const color = theme === "dark" ? ${JSON.stringify(themeColors.dark)} : ${JSON.stringify(themeColors.light)};
  for (const meta of document.querySelectorAll('meta[name="theme-color"]:not([media])')) {
    meta.setAttribute("content", color);
  }
} catch (_) {}
})();`
}
