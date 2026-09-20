import type {
	Appearance as IAppearance,
	NativeAppearanceSnapshot,
	NativePlatform,
	NativeScrollbarStyle,
} from "@cortex/platform"
import { invoke } from "./bridge"

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
		try {
			const native = await invoke<Partial<NativeAppearanceSnapshot>>("appearance_get_snapshot")
			return { ...snapshot, ...native }
		} catch {
			return snapshot
		}
	}

	subscribe(listener: (snapshot: NativeAppearanceSnapshot) => void): () => void {
		const queries = [
			window.matchMedia("(prefers-color-scheme: dark)"),
			window.matchMedia("(prefers-reduced-motion: reduce)"),
			window.matchMedia("(forced-colors: active)"),
		]
		const notify = () => {
			void this.getSnapshot().then(listener)
		}

		for (const query of queries) {
			query.addEventListener("change", notify)
		}

		return () => {
			for (const query of queries) {
				query.removeEventListener("change", notify)
			}
		}
	}
}
