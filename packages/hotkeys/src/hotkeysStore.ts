import { getPlatform } from "@cortex/platform"
import { create } from "zustand"
import { matchesEvent, parseHotkey } from "./parser"
import type { HotkeyBinding, HotkeyOverrides, ParsedHotkey } from "./types"

type HotkeyHandler = () => void

interface ParsedHotkeyBinding extends HotkeyBinding {
	parsedKeys: ParsedHotkey
}

interface HotkeysState {
	bindings: HotkeyBinding[]
	parsedBindings: ParsedHotkeyBinding[]
	handlers: Record<string, HotkeyHandler>
	overrides: HotkeyOverrides

	loadOverrides: (vaultPath: string) => Promise<void>
	saveOverrides: (vaultPath: string) => Promise<void>
	updateBinding: (id: string, keys: string) => void
	resetBinding: (id: string) => void
	resetAll: () => void
	registerHandler: (id: string, handler: HotkeyHandler) => void
	unregisterHandler: (id: string) => void
	handleKeyEvent: (event: KeyboardEvent) => boolean
	addBinding: (binding: HotkeyBinding) => void
	removeBinding: (id: string) => void
}

function applyOverride(binding: HotkeyBinding, overrides: HotkeyOverrides): HotkeyBinding {
	const override = overrides[binding.id]
	if (!override) return binding
	return {
		...binding,
		keys: override.keys ?? binding.defaultKeys,
		enabled: override.enabled ?? binding.enabled,
	}
}

function toParsedBinding(binding: HotkeyBinding): ParsedHotkeyBinding {
	return {
		...binding,
		parsedKeys: parseHotkey(binding.keys),
	}
}

function applyBindingList(bindings: HotkeyBinding[]): {
	bindings: HotkeyBinding[]
	parsedBindings: ParsedHotkeyBinding[]
} {
	return {
		bindings,
		parsedBindings: bindings.map(toParsedBinding),
	}
}

export const useHotkeysStore = create<HotkeysState>((set, get) => ({
	bindings: [],
	parsedBindings: [],
	handlers: {},
	overrides: {},

	loadOverrides: async (vaultPath) => {
		try {
			const platform = getPlatform()
			const configDir = await platform.storage.getVaultConfigDir(vaultPath)
			const raw = await platform.fs.readFile(`${configDir}/hotkeys.json`)
			const overrides: HotkeyOverrides = JSON.parse(raw)

			set({
				...applyBindingList(get().bindings.map((binding) => applyOverride(binding, overrides))),
				overrides,
			})
		} catch (_e) {
			set({
				...applyBindingList(get().bindings),
				overrides: {},
			})
		}
	},

	saveOverrides: async (vaultPath) => {
		const { bindings, overrides: currentOverrides } = get()
		const activeBindingIds = new Set(bindings.map((binding) => binding.id))
		const overrides: HotkeyOverrides = Object.fromEntries(
			Object.entries(currentOverrides).filter(([id]) => !activeBindingIds.has(id)),
		)

		for (const binding of bindings) {
			if (binding.keys !== binding.defaultKeys || !binding.enabled) {
				overrides[binding.id] = {
					keys: binding.keys,
					enabled: binding.enabled,
				}
			}
		}
		set({ overrides })

		try {
			const platform = getPlatform()
			const configDir = await platform.storage.getVaultConfigDir(vaultPath)
			await platform.fs.writeFile(
				`${configDir}/hotkeys.json`,
				JSON.stringify(overrides, null, "\t"),
			)
		} catch (_e) {}
	},

	updateBinding: (id, keys) => {
		set(applyBindingList(get().bindings.map((b) => (b.id === id ? { ...b, keys } : b))))
	},

	resetBinding: (id) => {
		set(
			applyBindingList(
				get().bindings.map((b) => (b.id === id ? { ...b, keys: b.defaultKeys, enabled: true } : b)),
			),
		)
	},

	resetAll: () => {
		set(
			applyBindingList(
				get().bindings.map((binding) => ({
					...binding,
					keys: binding.defaultKeys,
					enabled: true,
				})),
			),
		)
	},

	registerHandler: (id, handler) => {
		set({ handlers: { ...get().handlers, [id]: handler } })
	},

	unregisterHandler: (id) => {
		const { [id]: _, ...rest } = get().handlers
		set({ handlers: rest })
	},

	addBinding: (binding) => {
		const { bindings, overrides } = get()
		const nextBinding = applyOverride(binding, overrides)
		const existingIndex = bindings.findIndex((b) => b.id === binding.id)
		if (existingIndex >= 0) {
			set({
				...applyBindingList(
					bindings.map((existingBinding, index) =>
						index === existingIndex ? nextBinding : existingBinding,
					),
				),
			})
			return
		}
		set(applyBindingList([...bindings, nextBinding]))
	},

	removeBinding: (id) => {
		const { bindings } = get()
		set(applyBindingList(bindings.filter((binding) => binding.id !== id)))
	},

	handleKeyEvent: (event) => {
		const { parsedBindings, handlers } = get()

		for (const binding of parsedBindings) {
			if (!binding.enabled || binding.scope !== "global") continue
			const handler = handlers[binding.id]
			if (!handler) continue

			if (matchesEvent(binding.parsedKeys, event)) {
				event.preventDefault()
				handler()
				return true
			}
		}

		return false
	},
}))
