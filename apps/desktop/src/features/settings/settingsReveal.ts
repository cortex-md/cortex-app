import { createContext, useContext, useEffect } from "react"

export interface SettingsRevealTarget {
	section: string
	fieldId?: string
	fallbackId?: string
	focus: boolean
	nonce: number
}

const HIGHLIGHT_DURATION_MS = 1600
const MAX_ATTEMPTS = 10
const RETRY_DELAY_MS = 40
const FOCUSABLE =
	'input:not([type="hidden"]), select, textarea, button, [role="switch"], [tabindex]:not([tabindex="-1"])'

export const SettingsRevealContext = createContext<SettingsRevealTarget | null>(null)

export function useSettingsRevealTarget(): SettingsRevealTarget | null {
	return useContext(SettingsRevealContext)
}

function findField(section: string, fieldId: string): HTMLElement | null {
	const page = document.querySelector(
		`.settings-page-scroll[data-page-key="${CSS.escape(section)}"]`,
	)
	return page?.querySelector<HTMLElement>(`[data-settings-field="${CSS.escape(fieldId)}"]`) ?? null
}

function revealField(field: HTMLElement, focus: boolean): () => void {
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
	field.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" })
	if (focus) field.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true })
	field.dataset.settingsHighlight = "true"
	const timeoutId = window.setTimeout(() => {
		delete field.dataset.settingsHighlight
	}, HIGHLIGHT_DURATION_MS)
	return () => {
		window.clearTimeout(timeoutId)
		delete field.dataset.settingsHighlight
	}
}

export function useRevealSettingsField(target: SettingsRevealTarget): void {
	const { section, fieldId, fallbackId, focus, nonce } = target

	// biome-ignore lint/correctness/useExhaustiveDependencies: nonce re-runs the reveal for repeated targets
	useEffect(() => {
		if (!fieldId) return
		let attempt = 0
		let timeoutId = 0
		let frameId = 0
		let clearHighlight: (() => void) | null = null
		const tryReveal = () => {
			const field = findField(section, fieldId)
			if (field && !field.closest("[inert]")) {
				clearHighlight = revealField(field, focus)
				return
			}
			attempt += 1
			if (attempt < MAX_ATTEMPTS) {
				timeoutId = window.setTimeout(tryReveal, RETRY_DELAY_MS)
				return
			}
			const fallback = fallbackId ? findField(section, fallbackId) : null
			if (fallback) clearHighlight = revealField(fallback, focus)
		}
		frameId = window.requestAnimationFrame(tryReveal)
		return () => {
			window.cancelAnimationFrame(frameId)
			window.clearTimeout(timeoutId)
			clearHighlight?.()
		}
	}, [section, fieldId, fallbackId, focus, nonce])
}
