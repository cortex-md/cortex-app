import { ArrowLeft, ChevronLeft, X } from "lucide-react-native"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function AddVaultStepper({
	canGoBack,
	index,
	label,
	onBack,
	onClose,
	total,
}: {
	canGoBack: boolean
	index: number
	label: string | null
	onBack: () => void
	onClose: () => void
	total: number
}) {
	const { colors } = useMobileColors()
	const stepText = label ? `Step ${index + 1} of ${total} · ${label}` : null

	return (
		<View style={styles.root}>
			{IS_IOS ? <View style={[styles.grabber, { backgroundColor: colors.fill2 }]} /> : null}
			<View style={styles.bar}>
				{canGoBack ? (
					<Pressable accessibilityLabel="Back" hitSlop={8} onPress={onBack} style={styles.leading}>
						{IS_IOS ? (
							<ChevronLeft color={colors.tint} size={26} strokeWidth={2.4} />
						) : (
							<ArrowLeft color={colors.label} size={24} strokeWidth={2} />
						)}
					</Pressable>
				) : (
					<Pressable accessibilityLabel={IS_IOS ? "Cancel" : "Close"} hitSlop={8} onPress={onClose} style={styles.leading}>
						{IS_IOS ? (
							<Text style={[styles.cancel, { color: colors.tint }]}>Cancel</Text>
						) : (
							<X color={colors.label} size={24} strokeWidth={2} />
						)}
					</Pressable>
				)}
				{stepText ? (
					<Text numberOfLines={1} style={[styles.stepText, { color: colors.secondaryLabel }]}>
						{stepText}
					</Text>
				) : null}
			</View>
			{label ? (
				<View style={styles.dots}>
					{Array.from({ length: total }, (_, dot) => (
						<View
							key={dot}
							style={[
								styles.dot,
								{ backgroundColor: dot <= index ? colors.tintFill : colors.fill2 },
								dot === index ? styles.dotActive : null,
							]}
						/>
					))}
				</View>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	bar: {
		alignItems: "center",
		flexDirection: "row",
		gap: 8,
		minHeight: IS_IOS ? 44 : 64,
		paddingHorizontal: IS_IOS ? 16 : 4,
	},
	cancel: {
		fontSize: 17,
		lineHeight: 22,
	},
	dot: {
		borderRadius: 999,
		height: 6,
		width: 6,
	},
	dotActive: {
		width: 18,
	},
	dots: {
		flexDirection: "row",
		gap: 6,
		paddingHorizontal: 24,
		paddingTop: 4,
	},
	grabber: {
		alignSelf: "center",
		borderRadius: 999,
		height: 5,
		marginTop: 6,
		width: 36,
	},
	leading: {
		alignItems: "center",
		justifyContent: "center",
		minHeight: 44,
		minWidth: IS_IOS ? 44 : 48,
	},
	root: {
		paddingBottom: 4,
	},
	stepText: {
		flex: 1,
		fontSize: IS_IOS ? 13 : 14,
		lineHeight: 18,
		textAlign: IS_IOS ? "right" : "left",
	},
})
