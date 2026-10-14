import {
	buildSyncLogItems,
	formatSyncLogPaths,
	groupSyncLogItems,
	type SyncLogItem,
	type SyncLogLevel,
	useSyncLogStore,
	useVaultStore,
} from "@cortex/core"
import { getVaultFilePath } from "@cortex/platform/utils"
import { Stack } from "expo-router"
import { useState } from "react"
import { Alert, Platform, SectionList, StyleSheet, Text } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import type { MenuGroup } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { SymbolIcon, type SymbolName } from "@/components/ui/Symbol"
import { toast } from "@/features/feedback/useToast"
import { InsetListRow, InsetSectionHeader } from "@/features/history/InsetListRow"
import { openConflict, openNote } from "@/features/navigation/routes"
import {
	clearSyncLog,
	copySyncLog,
	formatSyncLogTime,
	getSyncLogEntries,
} from "@/features/sync/syncAdapter"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

type LevelFilter = "all" | SyncLogLevel

const LEVEL_OPTIONS: { label: string; value: LevelFilter }[] = [
	{ label: "All entries", value: "all" },
	{ label: "Info", value: "info" },
	{ label: "Warnings", value: "warn" },
	{ label: "Errors", value: "error" },
]

const TONE_SYMBOLS: Record<SyncLogItem["tone"], SymbolName> = {
	error: { sf: "exclamationmark.circle.fill", md: "error" },
	ok: { sf: "checkmark.circle.fill", md: "check_circle" },
	warn: { sf: "exclamationmark.triangle.fill", md: "warning" },
	neutral: { sf: "info.circle", md: "info" },
}

function LogRow({
	first,
	item,
	last,
	vaultPath,
}: {
	first: boolean
	item: SyncLogItem
	last: boolean
	vaultPath: string | null
}) {
	const { colors } = useMobileColors()
	const path = item.paths[0]
	const absolutePath = path && vaultPath ? getVaultFilePath(vaultPath, path) : null
	const toneColor =
		item.tone === "error"
			? colors.destructiveText
			: item.tone === "warn"
				? colors.warningText
				: item.tone === "ok"
					? colors.successText
					: colors.secondaryLabel
	const onPress =
		item.tone === "error" && absolutePath
			? () => (item.kind === "conflict" ? openConflict(absolutePath) : openNote(absolutePath))
			: undefined
	const paths = item.paths.length > 0 ? formatSyncLogPaths(item.paths) : undefined
	return (
		<InsetListRow
			chevron={Boolean(onPress)}
			first={first}
			last={last}
			leading={<SymbolIcon color={toneColor} name={TONE_SYMBOLS[item.tone]} size={20} />}
			onPress={onPress}
			subtitle={paths}
			title={item.title}
			trailing={
				<Text style={[styles.time, { color: colors.tertiaryLabel }]}>
					{formatSyncLogTime(item.timestamp)}
				</Text>
			}
		>
			{item.detail ? (
				<Text style={[styles.detail, { color: colors.secondaryLabel }]}>{item.detail}</Text>
			) : null}
		</InsetListRow>
	)
}

export function SyncLogsScreen() {
	const { colors } = useMobileColors()
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const entries = useSyncLogStore((state) => state.entries)
	const [level, setLevel] = useState<LevelFilter>("all")
	const [query, setQuery] = useState("")
	const [cleared, setCleared] = useState(false)
	const [now] = useState(() => Date.now())

	const items = cleared ? [] : buildSyncLogItems(getSyncLogEntries(entries))
	const normalizedQuery = query.trim().toLowerCase()
	const filtered = items.filter(
		(item) =>
			(level === "all" || item.level === level) &&
			(!normalizedQuery ||
				`${item.title} ${item.paths.join(" ")} ${item.detail ?? ""}`
					.toLowerCase()
					.includes(normalizedQuery)),
	)
	const sections = groupSyncLogItems(filtered, now).map((group) => ({
		data: group.items,
		title: group.label,
	}))

	const handleCopy = () => {
		void copySyncLog(items).then(() => toast("Copied the log"))
	}

	const handleClear = () => {
		Alert.alert("Clear the sync log?", undefined, [
			{ style: "cancel", text: "Cancel" },
			{
				onPress: () => {
					clearSyncLog()
					setCleared(true)
				},
				style: "destructive",
				text: "Clear",
			},
		])
	}

	const menuGroups: MenuGroup[] = [
		LEVEL_OPTIONS.map((option) => ({
			checked: level === option.value,
			key: option.value,
			label: option.label,
			onPress: () => setLevel(option.value),
		})),
		[
			{
				icon: { sf: "doc.on.doc", md: "content_copy" },
				key: "copy",
				label: "Copy log",
				onPress: handleCopy,
			},
			{
				destructive: true,
				icon: { sf: "trash", md: "delete" },
				key: "clear",
				label: "Clear log",
				onPress: handleClear,
			},
		],
	]

	return (
		<>
			<Stack.Screen
				options={{
					title: "Sync logs",
					headerRight: IS_IOS
						? undefined
						: () => (
								<NativeMenu
									accessibilityLabel="Sync log actions"
									groups={menuGroups}
									icon={{ sf: "ellipsis", md: "more_vert" }}
								/>
							),
				}}
			/>
			<Stack.SearchBar
				autoCapitalize="none"
				onCancelButtonPress={() => setQuery("")}
				onChangeText={(event) => setQuery(event.nativeEvent.text)}
				placeholder="Filter sync logs"
			/>
			{IS_IOS ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Menu accessibilityLabel="Sync log actions" icon="ellipsis">
						<Stack.Toolbar.Menu inline title="Show">
							{LEVEL_OPTIONS.map((option) => (
								<Stack.Toolbar.MenuAction
									isOn={level === option.value}
									key={option.value}
									onPress={() => setLevel(option.value)}
								>
									{option.label}
								</Stack.Toolbar.MenuAction>
							))}
						</Stack.Toolbar.Menu>
						<Stack.Toolbar.MenuAction icon="doc.on.doc" onPress={handleCopy}>
							Copy log
						</Stack.Toolbar.MenuAction>
						<Stack.Toolbar.MenuAction destructive icon="trash" onPress={handleClear}>
							Clear log
						</Stack.Toolbar.MenuAction>
					</Stack.Toolbar.Menu>
				</Stack.Toolbar>
			) : null}
			<SectionList
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				keyboardDismissMode="on-drag"
				keyExtractor={(item) => String(item.id)}
				ListEmptyComponent={
					<EmptyState
						icon={{ sf: "list.bullet.rectangle", md: "receipt_long" }}
						title={items.length === 0 ? "No sync activity" : "No matching entries"}
					/>
				}
				renderItem={({ index, item, section }) => (
					<LogRow
						first={index === 0}
						item={item}
						last={index === section.data.length - 1}
						vaultPath={vaultPath}
					/>
				)}
				renderSectionHeader={({ section }) => <InsetSectionHeader title={section.title} />}
				sections={sections}
				stickySectionHeadersEnabled={false}
				style={{ backgroundColor: colors.groupedBackground }}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 40,
	},
	detail: {
		fontSize: 13,
		lineHeight: 18,
	},
	time: {
		fontSize: 13,
		fontVariant: ["tabular-nums"],
		lineHeight: 18,
	},
})
