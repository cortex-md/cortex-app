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
import { CircleAlert, CircleCheck, EllipsisVertical, ListX, TriangleAlert } from "lucide-react-native"
import { useState } from "react"
import { Platform, StyleSheet, Text, View } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import { GroupedList, GroupedRow } from "@/components/ui/GroupedList"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { SearchField } from "@/components/ui/SearchField"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import { toast } from "@/features/feedback/useToast"
import { openConflict, openNote } from "@/features/navigation/routes"
import { ActionButton, SettingsBlock, SettingsPage } from "@/features/sync/SettingsPage"
import {
	clearSyncLog,
	copySyncLog,
	formatSyncLogTime,
	getSyncLogEntries,
} from "@/features/sync/syncAdapter"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const MONO_FONT = Platform.select({ ios: "Menlo", default: "monospace" })

type LevelFilter = "all" | SyncLogLevel

const LEVEL_OPTIONS: { label: string; value: LevelFilter }[] = [
	{ label: "All", value: "all" },
	{ label: "Info", value: "info" },
	{ label: "Warn", value: "warn" },
	{ label: "Error", value: "error" },
]

function LevelIcon({ item }: { item: SyncLogItem }) {
	const { colors } = useMobileColors()
	if (item.tone === "error") return <CircleAlert color={colors.destructiveText} size={22} strokeWidth={2} />
	if (item.tone === "warn") return <TriangleAlert color={colors.warningText} size={22} strokeWidth={2} />
	return (
		<CircleCheck
			color={item.tone === "ok" ? colors.successText : colors.secondaryLabel}
			size={22}
			strokeWidth={2}
		/>
	)
}

function LogRow({ item, vaultPath }: { item: SyncLogItem; vaultPath: string | null }) {
	const { colors } = useMobileColors()
	const path = item.paths[0]
	const absolutePath = path && vaultPath ? getVaultFilePath(vaultPath, path) : null
	return (
		<View>
			<GroupedRow
				leading={<LevelIcon item={item} />}
				title={item.title}
				trailing={
					<Text style={[styles.time, { color: colors.tertiaryLabel }]}>
						{formatSyncLogTime(item.timestamp)}
					</Text>
				}
			/>
			<View style={styles.rowBody}>
				{item.paths.length > 0 ? (
					<Text numberOfLines={1} style={[styles.path, { color: colors.secondaryLabel }]}>
						{formatSyncLogPaths(item.paths)}
					</Text>
				) : null}
				{item.detail ? (
					<Text style={[styles.detail, { color: colors.secondaryLabel }]}>{item.detail}</Text>
				) : null}
				{item.tone === "error" && absolutePath ? (
					<View style={styles.actions}>
						{item.kind === "conflict" ? (
							<ActionButton
								label="Resolve conflict"
								onPress={() => openConflict(absolutePath)}
							/>
						) : null}
						<ActionButton label="Open note" onPress={() => openNote(absolutePath)} variant="text" />
					</View>
				) : null}
			</View>
		</View>
	)
}

export function SyncLogsScreen() {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const entries = useSyncLogStore((state) => state.entries)
	const [level, setLevel] = useState<LevelFilter>("all")
	const [query, setQuery] = useState("")
	const [cleared, setCleared] = useState(false)

	const [now] = useState(() => Date.now())
	const items = cleared ? [] : buildSyncLogItems(getSyncLogEntries(entries, now))
	const normalizedQuery = query.trim().toLowerCase()
	const filtered = items.filter(
		(item) =>
			(level === "all" || item.level === level) &&
			(!normalizedQuery ||
				`${item.title} ${item.paths.join(" ")} ${item.detail ?? ""}`
					.toLowerCase()
					.includes(normalizedQuery)),
	)
	const groups = groupSyncLogItems(filtered, now)

	const handleCopy = () => {
		void copySyncLog(items).then(() => toast("Copied the log"))
	}

	const handleClear = () => {
		clearSyncLog()
		setCleared(true)
	}

	const menuGroups = [
		[{ key: "copy", label: "Copy", onPress: handleCopy }],
		[{ key: "clear", label: "Clear", destructive: true, onPress: handleClear }],
	]

	return (
		<>
			{IS_IOS ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.Menu accessibilityLabel="Sync log actions" icon="ellipsis">
						<Stack.Toolbar.MenuAction icon="doc.on.doc" onPress={handleCopy}>
							Copy
						</Stack.Toolbar.MenuAction>
						<Stack.Toolbar.MenuAction destructive icon="trash" onPress={handleClear}>
							Clear
						</Stack.Toolbar.MenuAction>
					</Stack.Toolbar.Menu>
				</Stack.Toolbar>
			) : (
				<Stack.Screen
					options={{
						headerRight: () => (
							<NativeMenu
								accessibilityLabel="Sync log actions"
								groups={menuGroups}
								icon={{ sf: "ellipsis", Lucide: EllipsisVertical }}
							/>
						),
					}}
				/>
			)}
			<SettingsPage>
				<View style={styles.filters}>
					<SegmentedControl
						accessibilityLabel="Log level"
						onChange={setLevel}
						options={LEVEL_OPTIONS}
						value={level}
					/>
				</View>
				<View style={styles.search}>
					<SearchField
						onChangeText={setQuery}
						onClear={() => setQuery("")}
						placeholder="Filter sync logs"
						value={query}
					/>
				</View>
				{groups.length === 0 ? (
					<EmptyState
						description="Choose another level."
						Icon={ListX}
						title="No matching log entries"
					/>
				) : (
					groups.map((group) => (
						<SettingsBlock key={group.label} title={group.label}>
							<GroupedList>
								{group.items.map((item) => (
									<LogRow item={item} key={item.id} vaultPath={vaultPath} />
								))}
							</GroupedList>
						</SettingsBlock>
					))
				)}
			</SettingsPage>
		</>
	)
}

const styles = StyleSheet.create({
	actions: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		marginTop: 8,
	},
	detail: {
		fontSize: 13,
		lineHeight: 18,
		marginTop: 2,
	},
	filters: {
		marginHorizontal: 16,
		marginTop: 12,
	},
	path: {
		fontFamily: MONO_FONT,
		fontSize: 12,
		lineHeight: 16,
	},
	search: {
		marginTop: 10,
	},
	rowBody: {
		paddingBottom: 10,
		paddingLeft: IS_IOS ? 50 : 56,
		paddingRight: 16,
	},
	time: {
		fontSize: 12,
		fontVariant: ["tabular-nums"],
		lineHeight: 16,
	},
})
