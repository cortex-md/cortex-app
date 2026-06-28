import type { ParsedHotkey } from "./types"

const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)

export function parseHotkey(hotkeyString: string): ParsedHotkey {
	const parts = hotkeyString.toLowerCase().split("+")
	return {
		mod: parts.includes("mod"),
		shift: parts.includes("shift"),
		alt: parts.includes("alt"),
		ctrl: parts.includes("ctrl"),
		meta: parts.includes("meta"),
		key: parts.filter((p) => !["mod", "shift", "alt", "ctrl", "meta"].includes(p))[0] ?? "",
	}
}

export function matchesEvent(parsed: ParsedHotkey, event: KeyboardEvent): boolean {
	const modPressed = isMac ? event.metaKey : event.ctrlKey

	if (parsed.mod && !modPressed) return false
	if (!parsed.mod && modPressed && !parsed.meta && !parsed.ctrl) return false

	if (parsed.shift && !event.shiftKey) return false
	if (!parsed.shift && event.shiftKey) return false

	if (parsed.alt && !event.altKey) return false
	if (!parsed.alt && event.altKey) return false

	if (parsed.ctrl && !event.ctrlKey) return false
	if (parsed.meta && !event.metaKey) return false

	const eventKey = event.key.toLowerCase()
	const parsedKey = parsed.key.toLowerCase()

	if (parsedKey === "tab") return eventKey === "tab"
	if (parsedKey === "enter") return eventKey === "enter"
	if (parsedKey === "escape") return eventKey === "escape"
	if (parsedKey === "backspace") return eventKey === "backspace"
	if (parsedKey === "delete") return eventKey === "delete"
	if (parsedKey === "space") return eventKey === " "

	return eventKey === parsedKey
}

export function formatHotkeyDisplay(hotkeyString: string): string {
	const parts = hotkeyString.toLowerCase().split("+")
	const symbols: string[] = []

	for (const part of parts) {
		if (part === "mod") symbols.push(isMac ? "⌘" : "Ctrl")
		else if (part === "shift") symbols.push(isMac ? "⇧" : "Shift")
		else if (part === "alt") symbols.push(isMac ? "⌥" : "Alt")
		else if (part === "ctrl") symbols.push(isMac ? "⌃" : "Ctrl")
		else if (part === "meta") symbols.push(isMac ? "⌘" : "Win")
		else if (part === "tab") symbols.push("⇥")
		else if (part === "enter") symbols.push("↩")
		else if (part === "escape") symbols.push("Esc")
		else if (part === "backspace") symbols.push("⌫")
		else if (part === "delete") symbols.push("⌦")
		else if (part === "space") symbols.push("Space")
		else symbols.push(part.toUpperCase())
	}

	return isMac ? symbols.join("") : symbols.join("+")
}
