import { formatHotkeyDisplay, useHotkeysStore } from "@cortex/commands/hotkeys"

export function useCommandHotkey(commandId: string): string | null {
	const keys = useHotkeysStore((state) => {
		const binding = state.bindings.find((entry) => entry.id === commandId)
		return binding?.enabled && binding.keys ? binding.keys : null
	})
	return keys ? formatHotkeyDisplay(keys) : null
}
