import { app, BrowserWindow, nativeTheme, systemPreferences } from "electron"
import { existsSync, readFileSync } from "node:fs"
import { settingsPath } from "./paths"

export interface NativeAppearanceSnapshot {
	platform: "macos" | "windows" | "linux"
	colorScheme: "light" | "dark"
	reducedMotion: boolean
	highContrast: boolean
	accentColor: string | null
	scrollbarStyle: "overlay" | "thin" | "classic"
}

const DEFAULT_NATIVE_WINDOW_EFFECTS = true

function detectPlatform(): NativeAppearanceSnapshot["platform"] {
	if (process.platform === "darwin") return "macos"
	if (process.platform === "win32") return "windows"
	return "linux"
}

function scrollbarStyleFor(
	platform: NativeAppearanceSnapshot["platform"],
): NativeAppearanceSnapshot["scrollbarStyle"] {
	if (platform === "macos") return "overlay"
	if (platform === "windows") return "thin"
	return "classic"
}

export function getAppearanceSnapshot(): Partial<NativeAppearanceSnapshot> {
	const platform = detectPlatform()
	let accentColor: string | null = null
	if (platform === "macos") {
		try {
			accentColor = systemPreferences.getAccentColor?.()
				? `#${systemPreferences.getAccentColor()}`
				: null
		} catch {
			accentColor = null
		}
	}
	return {
		platform,
		colorScheme: nativeTheme.shouldUseDarkColors ? "dark" : "light",
		reducedMotion: false,
		highContrast: nativeTheme.shouldUseHighContrastColors,
		accentColor,
		scrollbarStyle: scrollbarStyleFor(platform),
	}
}

export function readNativeWindowEffectsEnabled(): boolean {
	const path = settingsPath()
	if (!existsSync(path)) return DEFAULT_NATIVE_WINDOW_EFFECTS
	try {
		const content = JSON.parse(readFileSync(path, "utf8")) as {
			appearance?: { nativeWindowEffects?: boolean; nativeContentSurface?: boolean }
		}
		const appearance = content.appearance
		if (typeof appearance?.nativeWindowEffects === "boolean") {
			return appearance.nativeWindowEffects
		}
		if (typeof appearance?.nativeContentSurface === "boolean") {
			return appearance.nativeContentSurface
		}
	} catch {
		// Fall through.
	}
	return DEFAULT_NATIVE_WINDOW_EFFECTS
}

export function createMainWindow(loadUrl: string, preloadPath: string): BrowserWindow {
	const effectsEnabled = readNativeWindowEffectsEnabled()
	const platform = detectPlatform()

	const window = new BrowserWindow({
		width: 1280,
		height: 840,
		minWidth: 800,
		minHeight: 500,
		show: false,
		title: "Cortex",
		...(platform === "macos"
			? {
					titleBarStyle: "hiddenInset" as const,
					trafficLightPosition: { x: 14, y: 12 },
					vibrancy: effectsEnabled ? ("sidebar" as const) : undefined,
					visualEffectState: effectsEnabled ? ("active" as const) : undefined,
				}
			: {}),
		...(platform === "windows"
			? {
					backgroundMaterial: effectsEnabled ? ("mica" as const) : undefined,
					titleBarOverlay: true,
				}
			: {}),
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			spellcheck: true,
		},
	})

	void window.loadURL(loadUrl)
	window.once("ready-to-show", () => {
		window.show()
	})
	return window
}

export function closeCurrentWindow(): void {
	const focused = BrowserWindow.getFocusedWindow()
	focused?.close()
}

export function focusMainWindow(): void {
	const windows = BrowserWindow.getAllWindows()
	const main = windows[0]
	if (!main) return
	if (main.isMinimized()) main.restore()
	main.show()
	main.focus()
}

export function restartApp(): void {
	app.relaunch()
	app.exit(0)
}
