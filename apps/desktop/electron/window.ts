import { readFileSync } from "node:fs"
import type { NativeAppearanceSnapshot } from "@cortex/platform"
import {
	BrowserWindow,
	type BrowserWindowConstructorOptions,
	nativeTheme,
	shell,
	systemPreferences,
} from "electron"
import { appSettingsPath } from "./paths"
import { assertExternalUrl, isTrustedUrl } from "./security"
import { stopWatchersFor } from "./services/watcher"

type DesktopPlatform = "macos" | "windows" | "linux"

const SCROLLBAR_STYLES = {
	macos: "overlay",
	windows: "thin",
	linux: "classic",
} as const satisfies Record<DesktopPlatform, NativeAppearanceSnapshot["scrollbarStyle"]>

function detectPlatform(): DesktopPlatform {
	if (process.platform === "darwin") return "macos"
	if (process.platform === "win32") return "windows"
	return "linux"
}

function readAccentColor(platform: DesktopPlatform): string | null {
	if (platform !== "macos") return null
	try {
		const accent = systemPreferences.getAccentColor()
		return accent ? `#${accent}` : null
	} catch {
		return null
	}
}

export function getAppearanceSnapshot(): Partial<NativeAppearanceSnapshot> {
	const platform = detectPlatform()
	return {
		platform,
		colorScheme: nativeTheme.shouldUseDarkColors ? "dark" : "light",
		highContrast: nativeTheme.shouldUseHighContrastColors,
		accentColor: readAccentColor(platform),
		scrollbarStyle: SCROLLBAR_STYLES[platform],
	}
}

function readNativeWindowEffectsEnabled(): boolean {
	try {
		const settings = JSON.parse(readFileSync(appSettingsPath(), "utf8")) as {
			appearance?: { nativeWindowEffects?: boolean }
		}
		return settings.appearance?.nativeWindowEffects ?? true
	} catch {
		return true
	}
}

function openExternal(url: string): void {
	try {
		void shell.openExternal(assertExternalUrl(url))
	} catch (error) {
		console.warn("[window] blocked external navigation:", error)
	}
}

function guardNavigation(window: BrowserWindow): void {
	const ownerId = window.webContents.id
	window.webContents.setWindowOpenHandler(({ url }) => {
		openExternal(url)
		return { action: "deny" }
	})
	window.webContents.on("will-navigate", (event, url) => {
		if (isTrustedUrl(url)) return
		event.preventDefault()
		openExternal(url)
	})
	window.webContents.on("did-start-navigation", (details) => {
		if (details.isMainFrame && !details.isSameDocument) void stopWatchersFor(ownerId)
	})
	window.on("closed", () => void stopWatchersFor(ownerId))
}

function windowBackgroundColor(effectsEnabled: boolean): string | undefined {
	if (effectsEnabled && detectPlatform() !== "linux") return undefined
	return nativeTheme.shouldUseDarkColors ? "#1c1c1e" : "#f5f5f4"
}

function sharedWindowOptions(
	preloadPath: string,
	effectsEnabled: boolean,
): BrowserWindowConstructorOptions {
	return {
		show: false,
		backgroundColor: windowBackgroundColor(effectsEnabled),
		...(detectPlatform() === "macos" && {
			titleBarStyle: "hiddenInset",
			trafficLightPosition: { x: 14, y: 16 },
			vibrancy: effectsEnabled ? "sidebar" : undefined,
			visualEffectState: "followWindow",
		}),
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			spellcheck: true,
		},
	}
}

const DEV_SERVER_RETRY_MS = 1000
const DEV_SERVER_MAX_RETRIES = 60

function loadRenderer(window: BrowserWindow, url: string, attempt = 0): void {
	window.loadURL(url).catch((error: unknown) => {
		if (window.isDestroyed()) return
		const devServer = url.startsWith("http:") || url.startsWith("https:")
		if (devServer && attempt < DEV_SERVER_MAX_RETRIES) {
			if (attempt === 0) console.warn(`[window] dev server unavailable, retrying ${url}`)
			setTimeout(() => loadRenderer(window, url, attempt + 1), DEV_SERVER_RETRY_MS)
			return
		}
		console.error(`[window] failed to load ${url}:`, error)
	})
}

export function createMainWindow(
	loadUrl: string,
	preloadPath: string,
	bounds?: Electron.Rectangle,
): BrowserWindow {
	const effectsEnabled = readNativeWindowEffectsEnabled()
	const shared = sharedWindowOptions(preloadPath, effectsEnabled)
	const window = new BrowserWindow({
		...shared,
		width: bounds?.width ?? 1280,
		height: bounds?.height ?? 840,
		...(bounds && { x: bounds.x, y: bounds.y }),
		minWidth: 800,
		minHeight: 500,
		title: "Cortex",
		...(detectPlatform() === "windows" && {
			backgroundMaterial: effectsEnabled ? "mica" : undefined,
			titleBarOverlay: true,
		}),
	})

	guardNavigation(window)
	loadRenderer(window, loadUrl)
	return window
}
