const MODIFIERS: Record<string, string> = {
	mod: "CmdOrCtrl",
	cmd: "Command",
	meta: process.platform === "darwin" ? "Command" : "Super",
	ctrl: "Ctrl",
	control: "Ctrl",
	alt: "Alt",
	option: "Alt",
	shift: "Shift",
}

const KEYS: Record<string, string> = {
	arrowleft: "Left",
	arrowright: "Right",
	arrowup: "Up",
	arrowdown: "Down",
	enter: "Enter",
	return: "Enter",
	escape: "Esc",
	esc: "Esc",
	space: "Space",
	tab: "Tab",
	backspace: "Backspace",
	delete: "Delete",
	pageup: "PageUp",
	pagedown: "PageDown",
	home: "Home",
	end: "End",
	"+": "Plus",
}

export function toAccelerator(keys: string | null | undefined): string | undefined {
	if (!keys || /\s/.test(keys.trim())) return undefined
	const parts = keys.split(/\+(?!$)/).filter(Boolean)
	const key = parts.pop()
	if (!key) return undefined
	const modifiers = parts.map((part) => MODIFIERS[part.toLowerCase()])
	if (modifiers.some((modifier) => !modifier)) return undefined
	const mappedKey = KEYS[key.toLowerCase()] ?? (key.length === 1 ? key.toUpperCase() : key)
	return [...modifiers, mappedKey].join("+")
}
