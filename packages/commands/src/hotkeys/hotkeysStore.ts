import { getPlatform } from "@cortex/platform"
import { getVaultFilePath, VAULT_CONFIG_DIR } from "@cortex/platform/utils"
import { create } from "zustand"
import { type CommandEntry, commandRegistry } from "../index"
import { matchesEvent, parseHotkey } from "./parser"
import type { HotkeyBinding, HotkeyOverrides, ParsedHotkey } from "./types"

interface ParsedHotkeyBinding {
	binding: HotkeyBinding
	parsedKeys: ParsedHotkey
}

interface HotkeysState {
	bindings: HotkeyBinding[]
	parsedBindings: ParsedHotkeyBinding[]
	overrides: HotkeyOverrides

	syncCommands: (commands: readonly CommandEntry[]) => void
	applyBindings: (bindings: HotkeyBinding[], overrides: HotkeyOverrides) => void
	loadOverrides: (vaultPath: string) => Promise<void>
	saveOverrides: (vaultPath: string) => Promise<void>
	updateBinding: (id: string, keys: string) => void
	resetBinding: (id: string) => void
	resetAll: () => void
	handleKeyEvent: (event: KeyboardEvent) => boolean
}

function getHotkeysPath(vaultPath: string): string {
	return getVaultFilePath(vaultPath, `${VAULT_CONFIG_DIR}/hotkeys.json`)
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

function toBinding(command: CommandEntry): HotkeyBinding {
	const defaultKeys = command.hotkey?.defaultKeys ?? ""
	return {
		id: command.id,
		label: command.label,
		category: command.category,
		scope: command.hotkey?.scope ?? "global",
		defaultKeys,
		keys: defaultKeys,
		enabled: command.hotkey?.enabled ?? true,
	}
}

function isSameCommandBinding(existing: HotkeyBinding, next: HotkeyBinding): boolean {
	return (
		existing.label === next.label &&
		existing.category === next.category &&
		existing.scope === next.scope &&
		existing.defaultKeys === next.defaultKeys
	)
}

function withBindings(
	bindings: HotkeyBinding[],
	previous: ParsedHotkeyBinding[] = [],
): Pick<HotkeysState, "bindings" | "parsedBindings"> {
	const parsedByBinding = new Map(previous.map((parsed) => [parsed.binding, parsed]))
	return {
		bindings,
		parsedBindings: bindings.map(
			(binding) =>
				parsedByBinding.get(binding) ?? { binding, parsedKeys: parseHotkey(binding.keys) },
		),
	}
}

export const useHotkeysStore = create<HotkeysState>((set, get) => ({
	bindings: [],
	parsedBindings: [],
	overrides: {},

	syncCommands: (commands) => {
		const { bindings, parsedBindings, overrides } = get()
		const existingById = new Map(bindings.map((binding) => [binding.id, binding]))
		let changed = commands.length !== bindings.length
		const nextBindings = commands.map((command, index) => {
			const next = toBinding(command)
			const existing = existingById.get(command.id)
			if (existing && isSameCommandBinding(existing, next)) {
				if (bindings[index] !== existing) changed = true
				return existing
			}
			changed = true
			return applyOverride(next, overrides)
		})
		if (changed) set(withBindings(nextBindings, parsedBindings))
	},

	applyBindings: (bindings, overrides) => {
		set({ ...withBindings(bindings, get().parsedBindings), overrides })
	},

	loadOverrides: async (vaultPath) => {
		const resetBindings = get().bindings.map((binding) => ({
			...binding,
			keys: binding.defaultKeys,
			enabled: true,
		}))
		try {
			const raw = await getPlatform().fs.readFile(getHotkeysPath(vaultPath))
			const overrides: HotkeyOverrides = JSON.parse(raw)
			set({
				...withBindings(resetBindings.map((binding) => applyOverride(binding, overrides))),
				overrides,
			})
		} catch {
			set({ ...withBindings(resetBindings), overrides: {} })
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
			await getPlatform().fs.atomicWriteFile(
				getHotkeysPath(vaultPath),
				JSON.stringify(overrides, null, "\t"),
			)
		} catch {}
	},

	updateBinding: (id, keys) => {
		const { bindings, parsedBindings } = get()
		set(
			withBindings(
				bindings.map((binding) => (binding.id === id ? { ...binding, keys } : binding)),
				parsedBindings,
			),
		)
	},

	resetBinding: (id) => {
		const { bindings, parsedBindings } = get()
		set(
			withBindings(
				bindings.map((binding) =>
					binding.id === id ? { ...binding, keys: binding.defaultKeys, enabled: true } : binding,
				),
				parsedBindings,
			),
		)
	},

	resetAll: () => {
		set(
			withBindings(
				get().bindings.map((binding) => ({
					...binding,
					keys: binding.defaultKeys,
					enabled: true,
				})),
			),
		)
	},

	handleKeyEvent: (event) => {
		for (const { binding, parsedKeys } of get().parsedBindings) {
			if (!binding.enabled || binding.scope !== "global" || !binding.keys) continue
			if (!matchesEvent(parsedKeys, event)) continue
			if (!commandRegistry.execute(binding.id, { source: "hotkey" })) continue
			event.preventDefault()
			return true
		}
		return false
	},
}))
