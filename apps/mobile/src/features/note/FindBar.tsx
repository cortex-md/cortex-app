import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native"

import { Symbol } from "@/components/ui/Symbol"
import type { FindInNote } from "@/features/note/useFindInNote"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

function countLabel(find: FindInNote): string {
	if (!find.query) return ""
	return IS_IOS
		? `${find.result.current} of ${find.result.total}`
		: `${find.result.current}/${find.result.total}`
}

function StepButtons({ find }: { find: FindInNote }) {
	const { colors } = useMobileColors()
	const disabled = find.result.total === 0
	return (
		<>
			<Pressable
				accessibilityLabel="Previous match"
				disabled={disabled}
				hitSlop={4}
				onPress={() => find.step("prev")}
				style={[styles.stepButton, disabled ? styles.disabled : null]}
			>
				<Symbol
					color={colors.label}
					name={{ sf: "chevron.up", md: "keyboard_arrow_up" }}
					size={20}
				/>
			</Pressable>
			<Pressable
				accessibilityLabel="Next match"
				disabled={disabled}
				hitSlop={4}
				onPress={() => find.step("next")}
				style={[styles.stepButton, disabled ? styles.disabled : null]}
			>
				<Symbol
					color={colors.label}
					name={{ sf: "chevron.down", md: "keyboard_arrow_down" }}
					size={20}
				/>
			</Pressable>
		</>
	)
}

export function FindBar({ find }: { find: FindInNote }) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.wrap}>
			<View style={[styles.bar, { backgroundColor: colors.glass, borderColor: colors.glassEdge }]}>
				<View style={[styles.field, { backgroundColor: colors.fill }]}>
					<Symbol
						color={colors.secondaryLabel}
						name={{ sf: "magnifyingglass", md: "search" }}
						size={17}
					/>
					<TextInput
						accessibilityLabel="Find in note"
						autoCapitalize="none"
						autoCorrect={false}
						autoFocus
						onChangeText={find.setQuery}
						onSubmitEditing={() => find.step("next")}
						placeholder="Find in note"
						placeholderTextColor={colors.secondaryLabel}
						returnKeyType="search"
						style={[styles.input, { color: colors.label }]}
						submitBehavior="submit"
						value={find.query}
					/>
					<Text style={[styles.count, { color: colors.secondaryLabel }]}>{countLabel(find)}</Text>
				</View>
				<StepButtons find={find} />
			</View>
		</View>
	)
}

export function AndroidFindHeaderLeft({ find }: { find: FindInNote }) {
	const { colors } = useMobileColors()
	return (
		<Pressable
			accessibilityLabel="Close find"
			android_ripple={{ borderless: true, color: colors.hover }}
			onPress={find.close}
			style={styles.stepButton}
		>
			<Symbol color={colors.label} name={{ sf: "chevron.left", md: "arrow_back" }} size={24} />
		</Pressable>
	)
}

export function AndroidFindHeaderTitle({ find }: { find: FindInNote }) {
	const { colors } = useMobileColors()
	return (
		<TextInput
			accessibilityLabel="Find in note"
			autoCapitalize="none"
			autoCorrect={false}
			autoFocus
			onChangeText={find.setQuery}
			onSubmitEditing={() => find.step("next")}
			placeholder="Find in note"
			placeholderTextColor={colors.secondaryLabel}
			returnKeyType="search"
			style={[styles.androidInput, { color: colors.label }]}
			submitBehavior="submit"
			value={find.query}
		/>
	)
}

export function AndroidFindHeaderRight({ find }: { find: FindInNote }) {
	const { colors } = useMobileColors()
	return (
		<View style={styles.androidRight}>
			<Text style={[styles.count, { color: colors.secondaryLabel }]}>{countLabel(find)}</Text>
			<StepButtons find={find} />
		</View>
	)
}

const styles = StyleSheet.create({
	androidInput: {
		fontSize: 16,
		letterSpacing: 0.5,
		lineHeight: 24,
		minWidth: 160,
		padding: 0,
	},
	androidRight: {
		alignItems: "center",
		flexDirection: "row",
	},
	bar: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 28,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: "row",
		gap: 4,
		padding: 6,
	},
	count: {
		fontSize: 13,
		fontVariant: ["tabular-nums"],
		lineHeight: 18,
	},
	disabled: {
		opacity: 0.4,
	},
	field: {
		alignItems: "center",
		borderRadius: 999,
		flex: 1,
		flexDirection: "row",
		gap: 8,
		height: 40,
		paddingHorizontal: 12,
	},
	input: {
		flex: 1,
		fontSize: 17,
		lineHeight: 22,
		minWidth: 0,
		padding: 0,
	},
	stepButton: {
		alignItems: "center",
		height: 40,
		justifyContent: "center",
		width: 40,
	},
	wrap: {
		paddingBottom: 8,
		paddingHorizontal: 8,
		paddingTop: 6,
	},
})
