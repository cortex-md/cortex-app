import { initializeCoreProperties } from "@cortex/core"
import { initPlatform, type NativeAppearanceSnapshot, type NativePlatform } from "@cortex/platform"
import { setSearchBackend } from "@cortex/search"
import { generateCSSString, generateCSSVariables, initThemeManager } from "@cortex/theme"
import { pdfDocumentImport } from "../features/import-export/pdfDocumentImport"
import { createSearchWorkerBackend } from "../features/search/searchWorkerBackend"
import { WebThemeAdapter } from "../features/themes/webThemeAdapter"
import { electronPlatform } from "../platform/electron-platform"

let macosStylesRequested = false

function loadPlatformStyles(platform: NativePlatform) {
	if (platform !== "macos" || macosStylesRequested) return
	macosStylesRequested = true
	void import("../styles/macos.css")
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

function prewarmTextRendering() {
	const span = document.createElement("span")
	span.setAttribute("aria-hidden", "true")
	span.className = "native-text-prewarm"
	span.textContent = "😀✨✓✗中文日本語한국어"
	document.body.appendChild(span)
	requestAnimationFrame(() => requestAnimationFrame(() => span.remove()))
}

function syncWindowActive() {
	document.body.dataset.windowActive = String(document.hasFocus())
}

function detectInitialPlatform(): NativePlatform {
	const userAgent = window.navigator.userAgent.toLowerCase()
	if (userAgent.includes("macintosh")) return "macos"
	if (userAgent.includes("windows")) return "windows"
	return "linux"
}

export function initRenderer(): void {
	initPlatform({ ...electronPlatform, documentImport: pdfDocumentImport })
	initializeCoreProperties({ deviceType: "desktop" })
	setSearchBackend(createSearchWorkerBackend())
	initThemeManager("ink", new WebThemeAdapter(), { generateCSSString, generateCSSVariables })

	const initialPlatform = detectInitialPlatform()
	document.body.dataset.platform = initialPlatform
	loadPlatformStyles(initialPlatform)
	void electronPlatform.appearance.getSnapshot().then(applyNativeAppearance)
	const unsubscribeNativeAppearance = electronPlatform.appearance.subscribe(applyNativeAppearance)
	window.addEventListener("beforeunload", unsubscribeNativeAppearance, { once: true })
	syncWindowActive()
	window.addEventListener("focus", syncWindowActive)
	window.addEventListener("blur", syncWindowActive)
	prewarmTextRendering()
}
