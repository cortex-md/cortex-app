import { type CommandEntry, commandRegistry, executeCommand } from "@cortex/commands"
import { Terminal } from "lucide-react-native"
import { useMemo, useState, useSyncExternalStore } from "react"
import {
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { EmptyState } from "@/components/ui/EmptyState"
import { GroupedList, GroupedSectionHeader } from "@/components/ui/GroupedList"
import { SheetHeader } from "@/components/ui/SheetHeader"
import { dismissSheet } from "@/features/navigation/routes"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

interface CommandGroup {
	category: string
	commands: CommandEntry[]
}

function subscribe(listener: () => void): () => void {
	return commandRegistry.subscribe(listener)
}

function getSnapshot() {
	return commandRegistry.getSnapshot()
}

function matchesQuery(command: CommandEntry, needle: string): boolean {
	if (!needle) return true
	const haystack = [command.label, command.category, ...(command.aliases ?? [])]
		.join(" ")
		.toLowerCase()
	return needle.split(/\s+/).every((term) => haystack.includes(term))
}

function groupCommands(commands: readonly CommandEntry[], needle: string): CommandGroup[] {
	const groups = new Map<string, CommandEntry[]>()
	for (const command of commands) {
		if (!matchesQuery(command, needle)) continue
		const existing = groups.get(command.category) ?? []
		existing.push(command)
		groups.set(command.category, existing)
	}
	return Array.from(groups.entries()).map(([category, entries]) => ({
		category,
		commands: entries,
	}))
}

export function CommandPaletteSheet() {
	const { colors } = useMobileColors()
	const insets = useSafeAreaInsets()
	const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
	const [query, setQuery] = useState("")
	const needle = query.trim().replace(/^>/, "").trim().toLowerCase()
	const groups = useMemo(() => groupCommands(snapshot.commands, needle), [needle, snapshot])
	const firstCommandId = groups[0]?.commands[0]?.id ?? null

	const run = (command: CommandEntry) => {
		dismissSheet()
		executeCommand(command.id, { source: "palette", input: query })
	}

	return (
		<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
			<SheetHeader onClose={dismissSheet} title="Command palette" />
			<View style={styles.fieldWrap}>
				<View style={[styles.field, { backgroundColor: colors.fill }]}>
					{IS_IOS ? null : <Terminal color={colors.secondaryLabel} size={22} strokeWidth={2} />}
					<TextInput
						accessibilityLabel="Command"
						autoCapitalize="none"
						autoCorrect={false}
						autoFocus
						onChangeText={setQuery}
						onSubmitEditing={() => {
							const first = groups[0]?.commands[0]
							if (first) run(first)
						}}
						placeholder="Type a command..."
						placeholderTextColor={colors.secondaryLabel}
						returnKeyType="go"
						style={[styles.input, { color: colors.label }]}
						value={query}
					/>
				</View>
			</View>
			<ScrollView
				contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
				keyboardDismissMode="on-drag"
				keyboardShouldPersistTaps="handled"
			>
				{groups.length === 0 ? (
					<EmptyState
						description={needle ? `Nothing matches “${needle}”.` : "Commands appear here once registered."}
						title="No commands"
					/>
				) : (
					groups.map((group) => (
						<View key={group.category}>
							<GroupedSectionHeader>{group.category}</GroupedSectionHeader>
							<GroupedList>
								{group.commands.map((command) => {
									const highlighted = command.id === firstCommandId && needle.length > 0
									return (
										<Pressable
											accessibilityRole="button"
											android_ripple={{ color: colors.hover }}
											key={command.id}
											onPress={() => run(command)}
											style={({ pressed }) => [
												styles.row,
												{
													backgroundColor: highlighted
														? colors.accentSubtle
														: pressed && IS_IOS
															? colors.hover
															: "transparent",
												},
											]}
										>
											<Text
												numberOfLines={1}
												style={[
													styles.rowLabel,
													{
														color: highlighted ? colors.tint : colors.label,
														fontWeight: highlighted ? "600" : "400",
													},
												]}
											>
												{command.label}
											</Text>
											{command.hotkey ? (
												<Text style={[styles.rowMeta, { color: colors.tertiaryLabel }]}>
													{command.hotkey.defaultKeys}
												</Text>
											) : null}
										</Pressable>
									)
								})}
							</GroupedList>
						</View>
					))
				)}
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingTop: 4,
	},
	field: {
		alignItems: "center",
		borderRadius: IS_IOS ? 999 : 28,
		flexDirection: "row",
		gap: 10,
		height: IS_IOS ? 44 : 52,
		paddingHorizontal: 14,
	},
	fieldWrap: {
		paddingBottom: 8,
		paddingHorizontal: 16,
	},
	input: {
		flex: 1,
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: 22,
		minWidth: 0,
		padding: 0,
	},
	root: {
		flex: 1,
	},
	row: {
		alignItems: "center",
		flexDirection: "row",
		gap: 12,
		minHeight: IS_IOS ? 52 : 56,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	rowLabel: {
		flex: 1,
		fontSize: IS_IOS ? 17 : 16,
		lineHeight: 22,
	},
	rowMeta: {
		fontSize: 13,
		lineHeight: 18,
	},
})
