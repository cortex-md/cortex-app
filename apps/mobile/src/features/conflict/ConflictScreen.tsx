import { type DiffRow, getErrorMessage, useVaultStore } from "@cortex/core"
import { router, Stack, useLocalSearchParams } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native"

import type { MenuGroup } from "@/components/ui/menuTypes"
import { NativeMenu } from "@/components/ui/NativeMenu"
import {
	buildConflictDiff,
	keepLocalVersion,
	keepRemoteVersion,
	loadConflict,
	type NoteConflict,
} from "@/features/conflict/conflictAdapter"
import { toast } from "@/features/feedback/useToast"
import { useHideTabBar } from "@/features/navigation/tabBarVisibility"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"
const MONOSPACE = Platform.select({ android: "monospace", default: "Menlo" })

type Resolution = "local" | "remote"

function readParam(value: string | string[] | undefined): string | null {
	const resolved = Array.isArray(value) ? value[0] : value
	return resolved ? resolved : null
}

async function resolveConflict(conflict: NoteConflict, resolution: Resolution): Promise<boolean> {
	try {
		if (resolution === "local") await keepLocalVersion(conflict)
		else await keepRemoteVersion(conflict)
		toast(resolution === "local" ? "Kept the local version" : "Kept the remote version")
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

function DiffLine({ row }: { row: DiffRow }) {
	const { colors } = useMobileColors()
	if (row.type === "gap") {
		return (
			<Text style={[styles.diffLine, { color: colors.tertiaryLabel }]}>
				{`  ⋯ ${row.count} unchanged line${row.count === 1 ? "" : "s"}`}
			</Text>
		)
	}
	const text = row.segments.map((segment) => segment.text).join("")
	const prefix = row.kind === "del" ? "- " : row.kind === "add" ? "+ " : "  "
	const color =
		row.kind === "del"
			? colors.destructiveText
			: row.kind === "add"
				? colors.successText
				: colors.secondaryLabel
	return <Text style={[styles.diffLine, { color }]}>{`${prefix}${text}`}</Text>
}

export function ConflictScreen() {
	useHideTabBar()
	const params = useLocalSearchParams<{ filePath?: string | string[] }>()
	const filePath = readParam(params.filePath)
	const { colors } = useMobileColors()
	const { conflict, error } = useConflict(filePath)
	const [resolving, setResolving] = useState(false)

	const diff = useMemo(() => (conflict ? buildConflictDiff(conflict) : []), [conflict])
	const title = conflict?.title ?? filePath?.split("/").pop()?.replace(/\.md$/i, "") ?? "Conflict"
	const disabled = !conflict || resolving

	function resolve(resolution: Resolution) {
		if (!conflict || resolving) return
		setResolving(true)
		void resolveConflict(conflict, resolution).then((resolved) => {
			setResolving(false)
			if (resolved && router.canGoBack()) router.back()
		})
	}

	const resolveGroups: MenuGroup[] = [
		[
			{
				disabled,
				icon: { md: "smartphone", sf: "iphone" },
				key: "local",
				label: "Keep local",
				onPress: () => resolve("local"),
			},
			{
				disabled,
				icon: { md: "cloud", sf: "icloud" },
				key: "remote",
				label: "Keep remote",
				onPress: () => resolve("remote"),
			},
		],
	]

	return (
		<>
			<Stack.Screen
				options={{
					headerLargeTitleEnabled: false,
					headerRight: IS_IOS
						? undefined
						: () => (
								<NativeMenu accessibilityLabel="Resolve" groups={resolveGroups} title="Resolve" />
							),
					title,
				}}
			/>
			{IS_IOS ? (
				<Stack.Toolbar placement="bottom">
					<Stack.Toolbar.Button disabled={disabled} onPress={() => resolve("local")}>
						Keep local
					</Stack.Toolbar.Button>
					<Stack.Toolbar.Spacer />
					<Stack.Toolbar.Button disabled={disabled} onPress={() => resolve("remote")}>
						Keep remote
					</Stack.Toolbar.Button>
				</Stack.Toolbar>
			) : null}
			<ScrollView
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				style={{ backgroundColor: colors.background }}
			>
				<Text style={[styles.lead, { color: colors.secondaryLabel }]}>
					{error ??
						`${conflict?.relativePath ?? title} changed here and on another device. Keep one version; the other is replaced.`}
				</Text>
				{conflict ? (
					<View style={[styles.code, { backgroundColor: colors.codeBackground }]}>
						{diff.length > 0 ? (
							diff.map((row) => <DiffLine key={row.id} row={row} />)
						) : (
							<Text style={[styles.diffLine, { color: colors.secondaryLabel }]}>
								Both versions are identical.
							</Text>
						)}
					</View>
				) : null}
			</ScrollView>
		</>
	)
}

const styles = StyleSheet.create({
	code: {
		borderRadius: 10,
		gap: 2,
		marginHorizontal: 16,
		marginTop: 12,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	content: {
		paddingBottom: 120,
		paddingTop: 8,
	},
	diffLine: {
		fontFamily: MONOSPACE,
		fontSize: 14,
		lineHeight: 22,
	},
	lead: {
		fontSize: IS_IOS ? 15 : 14,
		lineHeight: 20,
		paddingHorizontal: 20,
	},
})
