import { type HotkeyBinding, parseHotkey, useHotkeysStore } from "@cortex/hotkeys"
import { useMemo } from "react"
import { Platform } from "react-native"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"

const IS_IOS = Platform.OS === "ios"

interface ShortcutGroup {
	title: string
	items: { id: string; label: string; keys: string }[]
}

const DEFAULT_SHORTCUTS: ShortcutGroup[] = [
	{
		title: "File",
		items: [
			{ id: "file.new", label: "New note", keys: "mod+n" },
			{ id: "bookmark.add", label: "Add bookmark", keys: "mod+shift+b" },
		],
	},
	{
		title: "Format",
		items: [
			{ id: "format.bold", label: "Bold", keys: "mod+b" },
			{ id: "format.italic", label: "Italic", keys: "mod+i" },
			{ id: "format.code", label: "Inline code", keys: "mod+`" },
			{ id: "format.link", label: "Link", keys: "mod+k" },
		],
	},
	{
		title: "Turn into",
		items: [
			{ id: "format.heading1", label: "Heading 1", keys: "mod+alt+1" },
			{ id: "format.heading2", label: "Heading 2", keys: "mod+alt+2" },
			{ id: "format.taskList", label: "Task list", keys: "mod+l" },
		],
	},
]

const KEY_GLYPHS: Record<string, string> = {
	backspace: "⌫",
	delete: "⌦",
	enter: "↩",
	escape: "Esc",
	space: "Space",
	tab: "⇥",
}

export function formatShortcut(keys: string): string {
	const parsed = parseHotkey(keys)
	const parts: string[] = []
	if (parsed.mod) parts.push(IS_IOS ? "⌘" : "Ctrl")
	if (parsed.ctrl) parts.push(IS_IOS ? "⌃" : "Ctrl")
	if (parsed.alt) parts.push(IS_IOS ? "⌥" : "Alt")
	if (parsed.shift) parts.push(IS_IOS ? "⇧" : "Shift")
	if (parsed.meta) parts.push(IS_IOS ? "⌘" : "Meta")
	parts.push(KEY_GLYPHS[parsed.key] ?? parsed.key.toUpperCase())
	return IS_IOS ? parts.join("") : parts.join("+")
}

function groupBindings(bindings: HotkeyBinding[]): ShortcutGroup[] {
	const groups = new Map<string, ShortcutGroup>()
	for (const binding of bindings) {
		if (!binding.keys || !binding.enabled) continue
		const group = groups.get(binding.category) ?? { title: binding.category, items: [] }
		group.items.push({ id: binding.id, label: binding.label, keys: binding.keys })
		groups.set(binding.category, group)
	}
	return [...groups.values()]
}

const FOOTER = IS_IOS
	? "Available with a hardware keyboard. Hold Command to see them."
	: "Available with a hardware keyboard. Press Meta + / to see them."

export function HotkeysSettingsScreen() {
	const bindings = useHotkeysStore((state) => state.bindings)
	const groups = useMemo(() => {
		const fromStore = groupBindings(bindings)
		return fromStore.length > 0 ? fromStore : DEFAULT_SHORTCUTS
	}, [bindings])

	return (
		<NativeForm>
			{groups.map((group, index) => (
				<FormSection
					footer={index === groups.length - 1 ? FOOTER : undefined}
					key={group.title}
					title={group.title}
				>
					{group.items.map((item) => (
						<FormRow key={item.id} title={item.label} value={formatShortcut(item.keys)} />
					))}
				</FormSection>
			))}
		</NativeForm>
	)
}
