import { type CommandEntry, commandRegistry, executeCommand } from "@cortex/commands"
import { Stack } from "expo-router"
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { Platform, SectionList, StyleSheet, Text } from "react-native"
import type { SearchBarCommands } from "react-native-screens"

import { EmptyState } from "@/components/ui/EmptyState"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import { dismissSheet } from "@/features/navigation/routes"
import { ListCell, ListSectionHeader, listCellStyles } from "@/features/search/ListCell"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const FOCUS_DELAY_MS = 350

interface CommandSection {
	title: string
	data: CommandEntry[]
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

function groupCommands(commands: readonly CommandEntry[], needle: string): CommandSection[] {
	const groups = new Map<string, CommandEntry[]>()
	for (const command of commands) {
		if (!matchesQuery(command, needle)) continue
		const existing = groups.get(command.category) ?? []
		existing.push(command)
		groups.set(command.category, existing)
	}
	return Array.from(groups.entries()).map(([title, data]) => ({ title, data }))
}

export function CommandPaletteSheet() {
	const { colors } = useMobileColors()
	const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
	const searchBarRef = useRef<SearchBarCommands>(null)
	const [query, setQuery] = useState("")
	const needle = query.trim().replace(/^>/, "").trim().toLowerCase()
	const sections = useMemo(() => groupCommands(snapshot.commands, needle), [needle, snapshot])

	useEffect(() => {
		if (!IS_IOS) return
		const timer = setTimeout(() => searchBarRef.current?.focus(), FOCUS_DELAY_MS)
		return () => clearTimeout(timer)
	}, [])

	const run = (command: CommandEntry) => {
		dismissSheet()
		executeCommand(command.id, { source: "palette", input: query })
	}

	return (
		<>
			<Stack.Screen
				options={{
					headerLeft: IS_IOS
						? undefined
						: () => (
								<HeaderIconButton
									accessibilityLabel="Close"
									icon={{ md: "close", sf: "xmark" }}
									onPress={dismissSheet}
								/>
							),
					title: "Commands",
				}}
			/>
			<Stack.SearchBar
				autoCapitalize="none"
				autoFocus
				hideNavigationBar={false}
				hideWhenScrolling={false}
				obscureBackground={false}
				onChangeText={(event) => setQuery(event.nativeEvent.text)}
				onSearchButtonPress={() => {
					const first = sections[0]?.data[0]
					if (first) run(first)
				}}
				placeholder="Search commands"
				placement="stacked"
				ref={searchBarRef}
			/>
			{IS_IOS ? (
				<Stack.Toolbar placement="left">
					<Stack.Toolbar.Button accessibilityLabel="Close" icon="xmark" onPress={dismissSheet} />
				</Stack.Toolbar>
			) : null}
			<SectionList
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				keyboardDismissMode="on-drag"
				keyboardShouldPersistTaps="handled"
				keyExtractor={(command) => command.id}
				ListEmptyComponent={
					<EmptyState
						icon={{ md: "terminal", sf: "terminal" }}
						title={needle ? `No commands match “${needle}”` : "No commands"}
					/>
				}
				renderItem={({ item, index, section }) => (
					<ListCell
						first={index === 0}
						last={index === section.data.length - 1}
						onPress={() => run(item)}
					>
						<Text
							numberOfLines={1}
							style={[listCellStyles.title, styles.label, { color: colors.label }]}
						>
							{item.label}
						</Text>
						{item.hotkey ? (
							<Text style={[listCellStyles.value, { color: colors.tertiaryLabel }]}>
								{item.hotkey.defaultKeys}
							</Text>
						) : null}
					</ListCell>
				)}
				renderSectionHeader={({ section }) => (
					<ListSectionHeader>{section.title}</ListSectionHeader>
				)}
				sections={sections}
				stickySectionHeadersEnabled={false}
				style={{ backgroundColor: IS_IOS ? colors.groupedBackground : colors.background }}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 32,
	},
	label: {
		flex: 1,
	},
})
