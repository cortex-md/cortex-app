import { tauriPlatform } from "@cortex/ipc"
import { initPlatform, type NativeAppearanceSnapshot } from "@cortex/platform"
import { generateCSSString, generateCSSVariables, initThemeManager } from "@cortex/theme"
import ReactDOM from "react-dom/client"
import App from "./App"
import { initializeDesktopDatabases } from "./databasesRuntime"
import { WebThemeAdapter } from "./features/themes/webThemeAdapter"
import { initializeDesktopProperties } from "./propertiesRuntime"
import "./styles.css"

initPlatform(tauriPlatform)
initializeDesktopProperties()
initializeDesktopDatabases()
initThemeManager("ink", new WebThemeAdapter(), { generateCSSString, generateCSSVariables })

let macosStylesPromise: Promise<unknown> | null = null

function loadPlatformStyles(platform: NativeAppearanceSnapshot["platform"]) {
	if (platform !== "macos") {
		return
	}
	macosStylesPromise ??= import("./styles.macos.css")
	void macosStylesPromise
}

function applyNativeAppearance(snapshot: NativeAppearanceSnapshot) {
	document.body.dataset.platform = snapshot.platform
	document.body.dataset.colorScheme = snapshot.colorScheme
	document.body.dataset.reducedMotion = String(snapshot.reducedMotion)
	document.body.dataset.highContrast = String(snapshot.highContrast)
	document.body.dataset.scrollbarStyle = snapshot.scrollbarStyle
	loadPlatformStyles(snapshot.platform)
	if (snapshot.accentColor) {
		document.body.style.setProperty("--system-accent", snapshot.accentColor)
	}
}

function refreshNativeAppearance() {
	tauriPlatform.appearance.getSnapshot().then(applyNativeAppearance)
}

function prewarmTextRendering() {
	const span = document.createElement("span")
	span.setAttribute("aria-hidden", "true")
	span.className = "native-text-prewarm"
	span.textContent = "😀✨✓✗中文日本語한국어"
	document.body.appendChild(span)
	requestAnimationFrame(() => requestAnimationFrame(() => span.remove()))
}

const initialAppearance = window.navigator.userAgent.toLowerCase().includes("macintosh")
	? "macos"
	: window.navigator.userAgent.toLowerCase().includes("windows")
		? "windows"
		: "linux"
document.body.dataset.platform = initialAppearance
loadPlatformStyles(initialAppearance)
refreshNativeAppearance()
const unsubscribeNativeAppearance = tauriPlatform.appearance.subscribe(applyNativeAppearance)
window.addEventListener("beforeunload", unsubscribeNativeAppearance, { once: true })
prewarmTextRendering()

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />)
