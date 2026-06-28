import type {
	Appearance as IAppearance,
	NativeAppearanceSnapshot,
	NativePlatform,
	NativeScrollbarStyle,
} from "@cortex/platform"
import { getCurrentWindow } from "@tauri-apps/api/window"

function detectPlatform(): NativePlatform {
	const ua = navigator.userAgent.toLowerCase()
	if (ua.includes("macintosh")) return "macos"
	if (ua.includes("windows")) return "windows"
	return "linux"
}

function resolveScrollbarStyle(platform: NativePlatform): NativeScrollbarStyle {
	if (platform === "macos") return "overlay"
	if (platform === "windows") return "thin"
	return "classic"
}

function readSnapshot(): NativeAppearanceSnapshot {
	const platform = detectPlatform()
	return {
		platform,
		colorScheme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
		reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
		highContrast: window.matchMedia("(forced-colors: active)").matches,
		accentColor: null,
		scrollbarStyle: resolveScrollbarStyle(platform),
	}
}

export class Appearance implements IAppearance {
	async getSnapshot(): Promise<NativeAppearanceSnapshot> {
		const snapshot = readSnapshot()
		const theme = await getCurrentWindow()
			.theme()
			.catch(() => null)
		return theme ? { ...snapshot, colorScheme: theme } : snapshot
	}

	subscribe(listener: (snapshot: NativeAppearanceSnapshot) => void): () => void {
		const queries = [
			window.matchMedia("(prefers-color-scheme: dark)"),
			window.matchMedia("(prefers-reduced-motion: reduce)"),
			window.matchMedia("(forced-colors: active)"),
		]
		const notify = () => {
			this.getSnapshot().then(listener)
		}

		for (const query of queries) {
			query.addEventListener("change", notify)
		}

		const themeUnlisten = getCurrentWindow()
			.onThemeChanged(() => notify())
			.catch(() => null)

		return () => {
			for (const query of queries) {
				query.removeEventListener("change", notify)
			}
			themeUnlisten.then((unlisten) => unlisten?.())
		}
	}
}
