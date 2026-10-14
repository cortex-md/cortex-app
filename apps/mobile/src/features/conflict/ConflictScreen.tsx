import { type DiffRow, getErrorMessage, useVaultStore } from "@cortex/core"
import { router, Stack, useLocalSearchParams } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { FlatList, Platform, StyleSheet, Text, View } from "react-native"

import type { MenuGroup } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { SegmentedControl } from "@/components/ui/SegmentedControl"
import {
	buildConflictDiff,
	keepBothVersions,
	keepLocalVersion,
	keepRemoteVersion,
	loadConflict,
	type NoteConflict,
} from "@/features/conflict/conflictAdapter"
import { toast } from "@/features/feedback/useToast"
import { openNote } from "@/features/navigation/routes"
import { useHideTabBar } from "@/features/navigation/tabBarVisibility"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const MONOSPACE = Platform.select({ android: "monospace", default: "Menlo" })

type Resolution = "local" | "remote" | "both"
type ConflictView = "changes" | "mine" | "theirs"

interface ConflictLine {
	id: string
	kind: "add" | "del" | "same" | "gap"
	text: string
}

const viewOptions: { label: string; value: ConflictView }[] = [
	{ label: "Changes", value: "changes" },
	{ label: "Mine", value: "mine" },
	{ label: "Theirs", value: "theirs" },
]

const resolutionMessages: Record<Resolution, string> = {
	both: "Both versions are in the note. Edit it to finish.",
	local: "Kept your version",
	remote: "Kept the other device's version",
}

function readParam(value: string | string[] | undefined): string | null {
	const resolved = Array.isArray(value) ? value[0] : value
	return resolved ? resolved : null
}

async function applyResolution(conflict: NoteConflict, resolution: Resolution): Promise<boolean> {
	try {
		if (resolution === "local") await keepLocalVersion(conflict)
		else if (resolution === "remote") await keepRemoteVersion(conflict)
		else await keepBothVersions(conflict)
		toast(resolutionMessages[resolution])
		return true
	} catch (error) {
		toast(getErrorMessage(error))
		return false
	}
}

function useConflict(filePath: string | null): {
	conflict: NoteConflict | null
	error: string | null
} {
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const [state, setState] = useState<{
		filePath: string
		conflict: NoteConflict | null
		error: string | null
	} | null>(null)

	useEffect(() => {
		if (!filePath) return
		let cancelled = false
		void loadConflict(filePath, vaultPath).then(
			(conflict) => {
				if (!cancelled) setState({ conflict, error: null, filePath })
			},
			(error: unknown) => {
				if (!cancelled) setState({ conflict: null, error: getErrorMessage(error), filePath })
			},
		)
		return () => {
			cancelled = true
		}
	}, [filePath, vaultPath])

	if (!filePath) return { conflict: null, error: "No note was selected." }
	if (state?.filePath !== filePath) return { conflict: null, error: null }
	return { conflict: state.conflict, error: state.error }
}

function diffLines(rows: DiffRow[]): ConflictLine[] {
	return rows.map((row) =>
		row.type === "gap"
			? {
					id: String(row.id),
					kind: "gap",
					text: `⋯ ${row.count} unchanged line${row.count === 1 ? "" : "s"}`,
				}
			: {
					id: String(row.id),
					kind: row.kind === "del" ? "del" : row.kind === "add" ? "add" : "same",
					text: row.segments.map((segment) => segment.text).join(""),
				},
	)
}

function plainLines(content: string, prefix: string): ConflictLine[] {
	return content
		.split("\n")
		.map((text, index) => ({ id: `${prefix}-${index}`, kind: "same", text }))
}

function linesFor(conflict: NoteConflict, view: ConflictView, diff: DiffRow[]): ConflictLine[] {
	if (view === "mine") return plainLines(conflict.localContent, "mine")
	if (view === "theirs") return plainLines(conflict.remoteContent ?? "", "theirs")
	return diffLines(diff)
}

function LineRow({ line }: { line: ConflictLine }) {
	const { colors } = useMobileColors()
	const background =
		line.kind === "add"
			? colors.successBackground
			: line.kind === "del"
				? colors.errorBackground
				: "transparent"
	const color =
		line.kind === "add"
			? colors.successText
			: line.kind === "del"
				? colors.destructiveText
				: line.kind === "gap"
					? colors.tertiaryLabel
					: colors.label
	return (
		<Text style={[styles.line, { backgroundColor: background, color }]}>{line.text || " "}</Text>
	)
}

function ConflictToolbar({
	disabled,
	resolve,
}: {
	disabled: boolean
	resolve: (resolution: Resolution) => void
}) {
	const groups: MenuGroup[] = [
		[
			{
				disabled,
				icon: { md: "smartphone", sf: "iphone" },
				key: "local",
				label: "Keep mine",
				onPress: () => resolve("local"),
			},
			{
				disabled,
				icon: { md: "cloud", sf: "icloud" },
				key: "remote",
				label: "Keep theirs",
				onPress: () => resolve("remote"),
			},
			{
				disabled,
				icon: { md: "merge", sf: "arrow.triangle.merge" },
				key: "both",
				label: "Keep both and edit",
				onPress: () => resolve("both"),
			},
		],
	]
	if (!IS_IOS) {
		return (
			<Stack.Screen
				options={{
					headerRight: () => (
						<NativeMenu accessibilityLabel="Resolve" groups={groups} title="Resolve" />
					),
				}}
			/>
		)
	}
	return (
		<Stack.Toolbar placement="bottom">
			<Stack.Toolbar.Button disabled={disabled} onPress={() => resolve("local")}>
				Keep mine
			</Stack.Toolbar.Button>
			<Stack.Toolbar.Spacer />
			<Stack.Toolbar.Menu disabled={disabled} icon="ellipsis" title="More">
				<Stack.Toolbar.MenuAction icon="arrow.triangle.merge" onPress={() => resolve("both")}>
					Keep both and edit
				</Stack.Toolbar.MenuAction>
			</Stack.Toolbar.Menu>
			<Stack.Toolbar.Spacer />
			<Stack.Toolbar.Button disabled={disabled} onPress={() => resolve("remote")}>
				Keep theirs
			</Stack.Toolbar.Button>
		</Stack.Toolbar>
	)
}

export function ConflictScreen() {
	useHideTabBar()
	const params = useLocalSearchParams<{ filePath?: string | string[] }>()
	const filePath = readParam(params.filePath)
	const { colors } = useMobileColors()
	const { conflict, error } = useConflict(filePath)
	const [resolving, setResolving] = useState(false)
	const [view, setView] = useState<ConflictView>("changes")

	const diff = useMemo(() => (conflict ? buildConflictDiff(conflict) : []), [conflict])
	const lines = useMemo(
		() => (conflict ? linesFor(conflict, view, diff) : []),
		[conflict, diff, view],
	)
	const title = conflict?.title ?? filePath?.split("/").pop()?.replace(/\.md$/i, "") ?? "Conflict"
	const theirsMissing = view === "theirs" && conflict?.remoteContent === null

	function resolve(resolution: Resolution) {
		if (!conflict || resolving) return
		setResolving(true)
		void applyResolution(conflict, resolution).then((resolved) => {
			setResolving(false)
			if (!resolved) return
			if (router.canGoBack()) router.back()
			if (resolution === "both") openNote(conflict.filePath)
		})
	}

	return (
		<>
			<Stack.Screen options={{ headerLargeTitleEnabled: false, title }} />
			<ConflictToolbar disabled={!conflict || resolving} resolve={resolve} />
			<FlatList
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				data={theirsMissing ? [] : lines}
				keyExtractor={(line) => line.id}
				ListEmptyComponent={
					conflict ? (
						<Text style={[styles.lead, { color: colors.secondaryLabel }]}>
							{theirsMissing
								? "The other device's version isn't available on this phone yet. Sync again to load it."
								: "Both versions are identical."}
						</Text>
					) : null
				}
				ListHeaderComponent={
					<View style={styles.header}>
						<Text style={[styles.lead, { color: colors.secondaryLabel }]}>
							{error ?? "This note changed here and on another device. Keep one version or both."}
						</Text>
						<SegmentedControl
							accessibilityLabel="Conflict view"
							onChange={setView}
							options={viewOptions}
							style={styles.segments}
							value={view}
						/>
					</View>
				}
				renderItem={({ item }) => <LineRow line={item} />}
				style={{ backgroundColor: colors.background }}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 120,
	},
	header: {
		gap: 12,
		paddingBottom: 12,
		paddingTop: 8,
	},
	lead: {
		fontSize: IS_IOS ? 15 : 14,
		lineHeight: 20,
		paddingHorizontal: 20,
	},
	line: {
		fontFamily: MONOSPACE,
		fontSize: 14,
		lineHeight: 22,
		paddingHorizontal: 16,
	},
	segments: {
		marginHorizontal: 16,
	},
})
