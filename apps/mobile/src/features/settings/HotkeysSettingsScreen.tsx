import { type HotkeyBinding, parseHotkey, useHotkeysStore } from "@cortex/hotkeys"
import { useMemo } from "react"
import { Platform, StyleSheet, Text, View } from "react-native"

import { SettingsRow } from "@/components/ui/SettingsRow"
import {
	SettingsBlock,
	SettingsIntro,
	SettingsScroll,
	SettingsSection,
} from "@/features/settings/SettingsLayout"
import { useMobileColors } from "@/hooks/useMobileColors"

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

function KeyChip({ keys }: { keys: string }) {
	const { colors } = useMobileColors()
	return (
		<View style={[styles.chip, { backgroundColor: colors.fill }]}>
			<Text style={[styles.chipLabel, { color: colors.secondaryLabel }]}>{formatShortcut(keys)}</Text>
		</View>
	)
}

export function HotkeysSettingsScreen() {
	const bindings = useHotkeysStore((state) => state.bindings)
	const groups = useMemo(() => {
		const fromStore = groupBindings(bindings)
		return fromStore.length > 0 ? fromStore : DEFAULT_SHORTCUTS
	}, [bindings])

	return (
		<SettingsScroll>
			<SettingsIntro>
				{IS_IOS
					? "Available when a hardware keyboard is connected. Hold Command in any screen to see them."
					: "Available when a hardware keyboard is connected. Press Meta + / to see them anywhere."}
			</SettingsIntro>
			{groups.map((group) => (
				<SettingsBlock key={group.title}>
					<SettingsSection title={group.title}>
						{group.items.map((item) => (
							<SettingsRow key={item.id} title={item.label} trailing={<KeyChip keys={item.keys} />} />
						))}
					</SettingsSection>
				</SettingsBlock>
			))}
		</SettingsScroll>
	)
}

const styles = StyleSheet.create({
	chip: {
		borderRadius: 7,
		paddingHorizontal: 8,
		paddingVertical: 3,
	},
	chipLabel: {
		fontFamily: IS_IOS ? "Menlo" : "monospace",
		fontSize: 13,
		lineHeight: 18,
	},
})
