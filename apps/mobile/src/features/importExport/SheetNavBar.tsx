import { ArrowLeft, Check, ChevronLeft, X } from "lucide-react-native"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export type SheetNavLeading =
	| { kind: "cancel"; onPress: () => void }
	| { kind: "close"; onPress: () => void }
	| { kind: "back"; onPress: () => void }
	| { kind: "none" }

export type SheetNavTrailing =
	| { kind: "text"; label: string; onPress: () => void; disabled?: boolean }
	| { kind: "done"; onPress: () => void }
	| { kind: "none" }

const NONE: SheetNavLeading & SheetNavTrailing = { kind: "none" }

export function SheetNavBar({
	leading = NONE,
	subtitle,
	title,
	trailing = NONE,
}: {
	leading?: SheetNavLeading
	subtitle?: string
	title: string
	trailing?: SheetNavTrailing
}) {
	const { colors } = useMobileColors()

	if (!IS_IOS) {
		const LeadingIcon = leading.kind === "back" ? ArrowLeft : X
		return (
			<View style={styles.m3Bar}>
				{leading.kind !== "none" ? (
					<Pressable
						accessibilityLabel={leading.kind === "back" ? "Back" : "Close"}
						accessibilityRole="button"
						android_ripple={{ borderless: true, color: colors.hover }}
						onPress={leading.onPress}
						style={styles.m3Icon}
					>
						<LeadingIcon color={colors.secondaryLabel} size={24} strokeWidth={2} />
					</Pressable>
				) : (
					<View style={styles.m3Spacer} />
				)}
				<View style={styles.m3Titles}>
					<Text numberOfLines={1} style={[styles.m3Title, { color: colors.label }]}>
						{title}
					</Text>
					{subtitle ? (
						<Text numberOfLines={1} style={[styles.m3Subtitle, { color: colors.secondaryLabel }]}>
							{subtitle}
						</Text>
					) : null}
				</View>
				{trailing.kind === "text" ? (
					<Pressable
						accessibilityRole="button"
						android_ripple={{ color: colors.hover }}
						disabled={trailing.disabled}
						onPress={trailing.onPress}
						style={[styles.m3TextButton, trailing.disabled ? styles.disabled : null]}
					>
						<Text style={[styles.m3TextLabel, { color: colors.tint }]}>{trailing.label}</Text>
					</Pressable>
				) : trailing.kind === "done" ? (
					<Pressable
						accessibilityRole="button"
						android_ripple={{ color: colors.hover }}
						onPress={trailing.onPress}
						style={styles.m3TextButton}
					>
						<Text style={[styles.m3TextLabel, { color: colors.tint }]}>Done</Text>
					</Pressable>
				) : null}
			</View>
		)
	}

	return (
		<View>
			<View style={styles.bar}>
				<View style={styles.side}>
					{leading.kind === "cancel" ? (
						<Pressable
							accessibilityRole="button"
							onPress={leading.onPress}
							style={({ pressed }) => [
								styles.glassText,
								{ backgroundColor: pressed ? colors.fill2 : colors.fill },
							]}
						>
							<Text style={[styles.glassLabel, { color: colors.label }]}>Cancel</Text>
						</Pressable>
					) : leading.kind === "close" || leading.kind === "back" ? (
						<Pressable
							accessibilityLabel={leading.kind === "back" ? "Back" : "Close"}
							accessibilityRole="button"
							onPress={leading.onPress}
							style={({ pressed }) => [
								styles.glassSquare,
								{ backgroundColor: pressed ? colors.fill2 : colors.fill },
							]}
						>
							{leading.kind === "back" ? (
								<ChevronLeft color={colors.label} size={22} strokeWidth={2.2} />
							) : (
								<X color={colors.label} size={20} strokeWidth={2.2} />
							)}
						</Pressable>
					) : null}
				</View>
				<View style={styles.titles}>
					<Text numberOfLines={1} style={[styles.title, { color: colors.label }]}>
						{title}
					</Text>
				</View>
				<View style={[styles.side, styles.sideEnd]}>
					{trailing.kind === "text" ? (
						<Pressable
							accessibilityRole="button"
							disabled={trailing.disabled}
							onPress={trailing.onPress}
							style={({ pressed }) => [
								styles.glassText,
								{ backgroundColor: colors.tintFill, opacity: pressed ? 0.8 : 1 },
								trailing.disabled ? styles.disabled : null,
							]}
						>
							<Text style={[styles.glassLabel, { color: colors.onTint }]}>{trailing.label}</Text>
						</Pressable>
					) : trailing.kind === "done" ? (
						<Pressable
							accessibilityLabel="Done"
							accessibilityRole="button"
							onPress={trailing.onPress}
							style={({ pressed }) => [
								styles.glassSquare,
								{ backgroundColor: colors.tintFill, opacity: pressed ? 0.8 : 1 },
							]}
						>
							<Check color={colors.onTint} size={20} strokeWidth={2.6} />
						</Pressable>
					) : null}
				</View>
			</View>
			{subtitle ? (
				<Text numberOfLines={1} style={[styles.subtitle, { color: colors.secondaryLabel }]}>
					{subtitle}
				</Text>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	bar: {
		alignItems: "center",
		flexDirection: "row",
		minHeight: 60,
		paddingHorizontal: 14,
		paddingVertical: 8,
	},
	disabled: {
		opacity: 0.4,
	},
	glassLabel: {
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
	},
	glassSquare: {
		alignItems: "center",
		borderRadius: 999,
		height: 44,
		justifyContent: "center",
		width: 44,
	},
	glassText: {
		alignItems: "center",
		borderRadius: 999,
		height: 44,
		justifyContent: "center",
		paddingHorizontal: 16,
	},
	m3Bar: {
		alignItems: "center",
		flexDirection: "row",
		gap: 4,
		minHeight: 64,
		paddingLeft: 4,
		paddingRight: 8,
	},
	m3Icon: {
		alignItems: "center",
		height: 48,
		justifyContent: "center",
		width: 48,
	},
	m3Spacer: {
		width: 12,
	},
	m3Subtitle: {
		fontSize: 12,
		letterSpacing: 0.5,
		lineHeight: 16,
	},
	m3TextButton: {
		alignItems: "center",
		borderRadius: 999,
		height: 40,
		justifyContent: "center",
		paddingHorizontal: 12,
	},
	m3TextLabel: {
		fontSize: 14,
		fontWeight: "500",
		letterSpacing: 0.1,
		lineHeight: 20,
	},
	m3Title: {
		fontSize: 22,
		lineHeight: 28,
	},
	m3Titles: {
		flex: 1,
		minWidth: 0,
		paddingLeft: 8,
	},
	side: {
		flexDirection: "row",
		minWidth: 44,
	},
	sideEnd: {
		justifyContent: "flex-end",
	},
	subtitle: {
		fontSize: 13,
		lineHeight: 18,
		marginBottom: 12,
		marginHorizontal: 20,
		marginTop: -6,
		textAlign: "center",
	},
	title: {
		fontSize: 17,
		fontWeight: "600",
		lineHeight: 22,
		textAlign: "center",
	},
	titles: {
		alignItems: "center",
		flex: 1,
		minWidth: 0,
	},
})
