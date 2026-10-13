import type { DiffRow } from "@cortex/core"
import { router, Stack, useLocalSearchParams } from "expo-router"
import { Copy, FilePlus, RotateCcw } from "lucide-react-native"
import { useState } from "react"
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from "react-native"

import { FloatingActionButton } from "@/components/ui/FloatingActionButton"
import { HeaderIconButton } from "@/components/ui/HeaderIconButton"
import MarkdownBlock from "@/components/ui/MarkdownBlock"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import { useMobileEditorThemeTokens } from "@/features/editor/editorTheme"
import { toast } from "@/features/feedback/useToast"
import { readParam, useVersionHistory } from "@/features/history/useVersionHistory"
import {
	copyVersionText,
	formatVersionMoment,
	getVersionDiff,
	openVersionAsCopy,
	restoreVersion,
	type VersionEntry,
	versionCopyName,
} from "@/features/history/versionHistoryAdapter"
import { openNote } from "@/features/navigation/routes"
import { useHideTabBar } from "@/features/navigation/tabBarVisibility"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const MONO_FONT = Platform.select({ ios: "Menlo", default: "monospace" })

type DetailMode = "changes" | "full"

const MODE_OPTIONS: { label: string; value: DetailMode }[] = [
	{ label: "Changes", value: "changes" },
	{ label: "Full note", value: "full" },
]

function DiffLine({ row }: { row: DiffRow }) {
	const { colors } = useMobileColors()
	if (row.type === "gap") {
		return (
			<View style={[styles.gap, { backgroundColor: colors.fill }]}>
				<Text style={[styles.gapText, { color: colors.secondaryLabel }]}>
					{`${row.count} unchanged ${row.count === 1 ? "line" : "lines"}`}
				</Text>
			</View>
		)
	}
	const isAdd = row.kind === "add"
	const isDel = row.kind === "del"
	const background = isAdd ? colors.successBackground : isDel ? colors.errorBackground : "transparent"
	const foreground = isAdd ? colors.successText : isDel ? colors.destructiveText : colors.label
	const highlight = isAdd ? colors.success : colors.destructive
	const onHighlight = isAdd ? colors.background : colors.onDestructive
	return (
		<View style={[styles.line, { backgroundColor: background }]}>
			<Text style={[styles.sign, { color: foreground }]}>{isAdd ? "+" : isDel ? "−" : " "}</Text>
			<Text style={[styles.lineText, { color: foreground }]}>
				{row.segments.map((segment) => (
					<Text
						key={segment.start}
						style={
							segment.changed && (isAdd || isDel)
								? [
										styles.changed,
										{ backgroundColor: highlight, color: onHighlight },
										isDel ? styles.deleted : null,
									]
								: null
						}
					>
						{segment.text}
					</Text>
				))}
			</Text>
		</View>
	)
}

export function VersionDetailScreen() {
	useHideTabBar()
	const { colors } = useMobileColors()
	const themeTokens = useMobileEditorThemeTokens()
	const params = useLocalSearchParams<{ filePath?: string | string[]; versionId?: string | string[] }>()
	const filePath = readParam(params.filePath)
	const versionId = readParam(params.versionId)
	const { history } = useVersionHistory(filePath)
	const [mode, setMode] = useState<DetailMode>("changes")

	const version: VersionEntry | undefined = history?.versions.find((entry) => entry.id === versionId)
	const noteName = history?.noteName ?? ""
	const subtitle = version
		? `${version.who} · ${version.device} · ${formatVersionMoment(version.timestamp)}`
		: ""

	const handleCopy = () => {
		if (!version) return
		void copyVersionText(version).then(() => toast("Copied"))
	}

	const handleOpenCopy = () => {
		if (!version) return
		void openVersionAsCopy(filePath, noteName, version).then((createdPath) => {
			toast(`Opened "${versionCopyName(noteName, version)}" as a new note`)
			openNote(createdPath)
		})
	}

	const handleRestore = () => {
		if (!version || version.isCurrent) return
		void restoreVersion(filePath, version).then(() => {
			toast(`Restored ${version.title}. The text you had is kept as a new version.`)
			if (router.canGoBack()) router.back()
		})
	}

	const restoreDisabled = !version || version.isCurrent

	return (
		<>
			<Stack.Screen
				options={{
					headerLargeTitleEnabled: false,
					title: version?.title ?? "",
					headerRight: IS_IOS
						? undefined
						: () => (
								<View style={styles.headerActions}>
									<HeaderIconButton accessibilityLabel="Copy text" Icon={Copy} onPress={handleCopy} />
									<HeaderIconButton accessibilityLabel="Open as copy" Icon={FilePlus} onPress={handleOpenCopy} />
								</View>
							),
				}}
			/>
			{IS_IOS ? (
				<Stack.Toolbar placement="bottom">
					<Stack.Toolbar.Button icon="doc.on.doc" onPress={handleCopy}>
						Copy text
					</Stack.Toolbar.Button>
					<Stack.Toolbar.Button icon="doc.badge.plus" onPress={handleOpenCopy}>
						Open as copy
					</Stack.Toolbar.Button>
					<Stack.Toolbar.Spacer />
					<Stack.Toolbar.Button disabled={restoreDisabled} onPress={handleRestore} variant="prominent">
						Restore this version
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
			<ScrollView
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.groupedBackground }}
			>
				{!version ? (
					<ActivityIndicator color={colors.tint} style={styles.loading} />
				) : (
					<>
						<Text style={[styles.subtitle, { color: colors.secondaryLabel }]}>{subtitle}</Text>
						<SegmentedControl
							accessibilityLabel="Show"
							onChange={setMode}
							options={MODE_OPTIONS}
							style={styles.segmented}
							value={mode}
						/>
						{mode === "changes" ? (
							<>
								<Text style={[styles.caption, { color: colors.secondaryLabel }]}>
									Compared with the version before it. Unchanged lines are folded.
								</Text>
								<View style={[styles.diff, { backgroundColor: colors.cell }]}>
									{getVersionDiff(version).map((row) => (
										<DiffLine key={row.id} row={row} />
									))}
								</View>
							</>
						) : (
							<View style={[styles.full, { backgroundColor: colors.cell }]}>
								<MarkdownBlock
									content={version.content}
									dom={{
										matchContents: true,
										scrollEnabled: false,
										style: styles.transparent,
										useExpoDOMWebView: false,
									}}
									themeTokens={themeTokens}
								/>
							</View>
						)}
					</>
				)}
			</ScrollView>
			{!IS_IOS && !restoreDisabled ? (
				<View style={styles.fab}>
					<FloatingActionButton
						Icon={RotateCcw}
						label="Restore this version"
						onPress={handleRestore}
						sf="clock.arrow.circlepath"
					/>
				</View>
			) : null}
		</>
	)
}

const styles = StyleSheet.create({
	caption: {
		fontSize: 13,
		lineHeight: 18,
		marginBottom: 8,
		marginHorizontal: 20,
		marginTop: 16,
	},
	changed: {
		borderRadius: 3,
	},
	content: {
		paddingBottom: 120,
	},
	deleted: {
		textDecorationLine: "line-through",
	},
	diff: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 20 : 16,
		marginHorizontal: 16,
		overflow: "hidden",
		paddingVertical: 6,
	},
	fab: {
		bottom: 24,
		position: "absolute",
		right: 16,
	},
	full: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 20 : 16,
		marginHorizontal: 16,
		marginTop: 16,
		overflow: "hidden",
		padding: 12,
	},
	gap: {
		marginVertical: 4,
		paddingHorizontal: 12,
		paddingVertical: 4,
	},
	gapText: {
		fontSize: 12,
		lineHeight: 16,
	},
	headerActions: {
		flexDirection: "row",
	},
	line: {
		flexDirection: "row",
		gap: 8,
		paddingHorizontal: 12,
		paddingVertical: 3,
	},
	lineText: {
		flex: 1,
		fontFamily: MONO_FONT,
		fontSize: 13,
		lineHeight: 20,
	},
	loading: {
		marginTop: 32,
	},
	segmented: {
		marginHorizontal: 16,
		marginTop: 12,
	},
	sign: {
		fontFamily: MONO_FONT,
		fontSize: 13,
		lineHeight: 20,
		width: 12,
	},
	subtitle: {
		fontSize: 13,
		lineHeight: 18,
		marginHorizontal: 20,
		marginTop: 8,
		textAlign: IS_IOS ? "center" : "left",
	},
	transparent: {
		backgroundColor: "transparent",
	},
})
