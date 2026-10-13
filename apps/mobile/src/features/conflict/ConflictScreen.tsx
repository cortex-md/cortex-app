import { type DiffRow, getErrorMessage, parseFrontmatter, useVaultStore } from "@cortex/core"
import { router, Stack, useLocalSearchParams } from "expo-router"
import { TriangleAlert } from "lucide-react-native"
import { useEffect, useMemo, useRef, useState } from "react"
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

import MarkdownBlock from "@/components/ui/MarkdownBlock"
import {
	buildConflictDiff,
	keepLocalVersion,
	keepRemoteVersion,
	loadConflict,
	type NoteConflict,
} from "@/features/conflict/conflictAdapter"
import { useMobileEditorThemeTokens } from "@/features/editor/editorTheme"
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

function HeaderTitle({ title }: { title: string }) {
	const { colors } = useMobileColors()
	return (
		<View style={IS_IOS ? styles.headerCenter : undefined}>
			<Text numberOfLines={1} style={[styles.headerTitle, { color: colors.label }]}>
				{title}
			</Text>
			<View style={styles.headerSubtitleRow}>
				<TriangleAlert color={colors.destructiveText} size={12} strokeWidth={2.4} />
				<Text style={[styles.headerSubtitle, { color: colors.destructiveText }]}>Sync Error</Text>
			</View>
		</View>
	)
}

function BannerButton({
	disabled,
	label,
	onPress,
	plain = false,
}: {
	disabled?: boolean
	label: string
	onPress: () => void
	plain?: boolean
}) {
	const { colors } = useMobileColors()
	return (
		<Pressable
			accessibilityRole="button"
			android_ripple={{ color: colors.hover }}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.bannerButton,
				plain ? styles.bannerButtonPlain : { backgroundColor: colors.cell },
				{ opacity: pressed || disabled ? 0.6 : 1 },
			]}
		>
			<Text style={[styles.bannerButtonLabel, { color: plain ? colors.tint : colors.label }]}>
				{label}
			</Text>
		</Pressable>
	)
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
	const themeTokens = useMobileEditorThemeTokens()
	const { conflict, error } = useConflict(filePath)
	const [resolving, setResolving] = useState(false)
	const scrollRef = useRef<ScrollView>(null)
	const diffOffset = useRef(0)

	const diff = useMemo(() => (conflict ? buildConflictDiff(conflict) : []), [conflict])
	const body = useMemo(
		() => (conflict ? parseFrontmatter(conflict.localContent).body : ""),
		[conflict],
	)
	const title = conflict?.title ?? filePath?.split("/").pop()?.replace(/\.md$/i, "") ?? "Conflict"

	function resolve(resolution: Resolution) {
		if (!conflict || resolving) return
		setResolving(true)
		void resolveConflict(conflict, resolution).then((resolved) => {
			setResolving(false)
			if (resolved && router.canGoBack()) router.back()
		})
	}

	return (
		<View style={[styles.root, { backgroundColor: colors.background }]}>
			<Stack.Screen
				options={{
					headerLargeTitleEnabled: false,
					headerTitle: () => <HeaderTitle title={title} />,
				}}
			/>
			<ScrollView
				contentContainerStyle={styles.content}
				contentInsetAdjustmentBehavior="automatic"
				ref={scrollRef}
			>
				<View
					accessibilityRole="alert"
					style={[
						styles.banner,
						{ backgroundColor: colors.warningBackground, borderColor: colors.warning },
					]}
				>
					<View style={styles.bannerTitleRow}>
						{IS_IOS ? null : (
							<TriangleAlert color={colors.warningText} size={20} strokeWidth={2.2} />
						)}
						<Text
							style={[styles.bannerTitle, { color: IS_IOS ? colors.label : colors.warningText }]}
						>
							Sync conflict
						</Text>
					</View>
					<Text style={[styles.bannerText, { color: colors.label }]}>
						{`Conflict in ${conflict?.relativePath ?? filePath ?? ""}`}
					</Text>
					<View style={styles.bannerActions}>
						<BannerButton
							disabled={!conflict || resolving}
							label="Keep Local"
							onPress={() => resolve("local")}
						/>
						<BannerButton
							disabled={!conflict || resolving}
							label="Keep Remote"
							onPress={() => resolve("remote")}
						/>
						<BannerButton
							disabled={!conflict}
							label="View Diff"
							onPress={() => scrollRef.current?.scrollTo({ animated: true, y: diffOffset.current })}
							plain
						/>
					</View>
				</View>

				{error ? (
					<Text style={[styles.paragraph, { color: colors.secondaryLabel }]}>{error}</Text>
				) : null}

				{conflict ? (
					<View style={styles.article}>
						{conflict.crumb.length > 0 ? (
							<Text style={[styles.crumb, { color: colors.secondaryLabel }]}>
								{conflict.crumb.join(" / ")}
							</Text>
						) : null}
						<Text style={[styles.title, { color: colors.label }]}>{conflict.title}</Text>
						{body.trim() ? (
							<MarkdownBlock
								content={body}
								dom={{
									matchContents: true,
									scrollEnabled: false,
									style: styles.transparent,
									useExpoDOMWebView: false,
								}}
								themeTokens={themeTokens}
							/>
						) : null}
						<View onLayout={(event) => (diffOffset.current = event.nativeEvent.layout.y)}>
							<Text style={[styles.heading, { color: colors.label }]}>Diff</Text>
							<View style={[styles.code, { backgroundColor: colors.codeBackground }]}>
								{diff.length > 0 ? (
									diff.map((row) => <DiffLine key={row.id} row={row} />)
								) : (
									<Text style={[styles.diffLine, { color: colors.secondaryLabel }]}>
										Both versions are identical.
									</Text>
								)}
							</View>
						</View>
					</View>
				) : null}
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	article: {
		gap: 10,
		paddingHorizontal: 20,
		paddingTop: 8,
	},
	banner: {
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 20 : 16,
		borderWidth: StyleSheet.hairlineWidth,
		gap: 8,
		marginBottom: 12,
		marginHorizontal: 16,
		marginTop: 8,
		padding: 16,
	},
	bannerActions: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
	bannerButton: {
		alignItems: "center",
		borderRadius: 999,
		height: IS_IOS ? 34 : 40,
		justifyContent: "center",
		paddingHorizontal: 14,
	},
	bannerButtonLabel: {
		fontSize: IS_IOS ? 15 : 14,
		fontWeight: IS_IOS ? "600" : "500",
	},
	bannerButtonPlain: {
		paddingHorizontal: 8,
	},
	bannerText: {
		fontSize: IS_IOS ? 15 : 14,
		lineHeight: 20,
	},
	bannerTitle: {
		fontSize: IS_IOS ? 17 : 16,
		fontWeight: "600",
		lineHeight: 22,
	},
	bannerTitleRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
	},
	code: {
		borderRadius: 10,
		gap: 2,
		marginTop: 8,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	content: {
		paddingBottom: 120,
	},
	crumb: {
		fontSize: 13,
		lineHeight: 18,
	},
	diffLine: {
		fontFamily: MONOSPACE,
		fontSize: 14,
		lineHeight: 22,
	},
	headerCenter: {
		alignItems: "center",
	},
	headerSubtitle: {
		fontSize: 12,
		fontWeight: "500",
		lineHeight: 16,
	},
	headerSubtitleRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 4,
	},
	headerTitle: {
		fontSize: IS_IOS ? 17 : 22,
		fontWeight: IS_IOS ? "600" : "400",
		lineHeight: IS_IOS ? 22 : 28,
	},
	heading: {
		fontSize: 22,
		fontWeight: "700",
		lineHeight: 28,
		marginTop: 12,
	},
	paragraph: {
		fontSize: 15,
		lineHeight: 20,
		paddingHorizontal: 20,
	},
	root: {
		flex: 1,
	},
	title: {
		fontSize: 28,
		fontWeight: "700",
		lineHeight: 34,
	},
	transparent: {
		backgroundColor: "transparent",
	},
})
