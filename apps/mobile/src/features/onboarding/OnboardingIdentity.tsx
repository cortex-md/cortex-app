import { Check, ChevronsUpDown } from "lucide-react-native"
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"

import { GroupedFooter, GroupedList, GroupedRow, GroupedSectionHeader } from "@/components/ui/GroupedList"
import { MobileTextField } from "@/components/ui/MobileTextField"
import { NativeMenu } from "@/components/ui/NativeMenu"
import { OnboardingButton, OnboardingTitle, OnboardingTopBar } from "@/features/onboarding/OnboardingChrome"
import {
	findVaultIcon,
	getVaultColorOptions,
	vaultIconOptions,
} from "@/features/onboarding/vaultAppearance"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

export function OnboardingIdentity({
	color,
	icon,
	name,
	onBack,
	onChangeColor,
	onChangeIcon,
	onChangeName,
	onContinue,
}: {
	color: string
	icon: string
	name: string
	onBack: () => void
	onChangeColor: (color: string) => void
	onChangeIcon: (icon: string) => void
	onChangeName: (name: string) => void
	onContinue: () => void
}) {
	const { colors } = useMobileColors()
	const colorOptions = getVaultColorOptions(colors)
	const selectedIcon = findVaultIcon(icon)
	const SelectedIcon = selectedIcon.Icon
	const canContinue = name.trim().length > 0

	return (
		<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
			<OnboardingTopBar onBack={onBack} />
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
				style={styles.scroll}
			>
				<OnboardingTitle subtitle="Customize your vault the way you want." title="Create new vault" />

				{IS_IOS ? (
					<>
						<View style={[styles.previewCard, { backgroundColor: colors.cell }]}>
							<VaultPreview color={color} name={name} SelectedIcon={SelectedIcon} />
						</View>
						<GroupedFooter>Preview of the vault switcher.</GroupedFooter>
					</>
				) : (
					<View style={styles.previewAndroid}>
						<VaultPreview color={color} name={name} SelectedIcon={SelectedIcon} />
					</View>
				)}

				{IS_IOS ? (
					<>
						<GroupedSectionHeader>Name</GroupedSectionHeader>
						<View style={[styles.nameCell, { backgroundColor: colors.cell }]}>
							<TextInput
								accessibilityLabel="Vault name"
								autoCapitalize="words"
								autoCorrect={false}
								onChangeText={onChangeName}
								onSubmitEditing={canContinue ? onContinue : undefined}
								placeholder="Vault name"
								placeholderTextColor={colors.secondaryLabel}
								returnKeyType="done"
								style={[styles.nameInput, { color: colors.label }]}
								value={name}
							/>
						</View>
					</>
				) : (
					<View style={styles.androidField}>
						<MobileTextField
							autoCapitalize="words"
							autoCorrect={false}
							label="Name"
							onChangeText={onChangeName}
							onSubmitText={canContinue ? onContinue : undefined}
							returnKeyType="done"
							value={name}
						/>
					</View>
				)}

				<GroupedSectionHeader>Color</GroupedSectionHeader>
				<View
					accessibilityLabel="Vault color"
					accessibilityRole="radiogroup"
					style={[styles.swatches, IS_IOS ? { backgroundColor: colors.cell } : styles.swatchesAndroid]}
				>
					{colorOptions.map((option) => {
						const selected = option.hex === color
						return (
							<Pressable
								accessibilityLabel={option.label}
								accessibilityRole="radio"
								accessibilityState={{ checked: selected }}
								key={option.label}
								onPress={() => onChangeColor(option.hex)}
								style={[
									styles.swatchRing,
									{ borderColor: selected ? colors.tint : "transparent" },
								]}
							>
								<View style={[styles.swatch, { backgroundColor: option.hex }]}>
									{selected && !IS_IOS ? <Check color={colors.onTint} size={18} strokeWidth={2.6} /> : null}
								</View>
							</Pressable>
						)
					})}
				</View>

				<GroupedSectionHeader>Icon</GroupedSectionHeader>
				<GroupedList>
					<GroupedRow
						chevron
						leading={<SelectedIcon color={colors.label} size={20} strokeWidth={2} />}
						title="Icon"
						trailing={
							<NativeMenu
								accessibilityLabel="Choose icon"
								anchorStyle="plain"
								groups={[
									vaultIconOptions.map((option) => ({
										checked: option.icon === icon,
										key: option.icon,
										label: option.label,
										onPress: () => onChangeIcon(option.icon),
									})),
								]}
								title={selectedIcon.label}
							/>
						}
					/>
				</GroupedList>
			</ScrollView>
			<View style={styles.footer}>
				<OnboardingButton disabled={!canContinue} label="Continue" onPress={onContinue} variant="primary" />
			</View>
		</View>
	)
}

function VaultPreview({
	SelectedIcon,
	color,
	name,
}: {
	SelectedIcon: ReturnType<typeof findVaultIcon>["Icon"]
	color: string
	name: string
}) {
	const { colors } = useMobileColors()
	return (
		<View style={[styles.pill, { backgroundColor: IS_IOS ? colors.fill : colors.fill2 }]}>
			<View style={[styles.dot, { backgroundColor: color }]} />
			<SelectedIcon color={colors.label} size={20} strokeWidth={2} />
			<Text numberOfLines={1} style={[styles.pillName, { color: colors.label }]}>
				{name.trim() || "Untitled vault"}
			</Text>
			<ChevronsUpDown color={colors.tertiaryLabel} size={14} strokeWidth={2.4} />
		</View>
	)
}

const styles = StyleSheet.create({
	androidField: {
		paddingHorizontal: 16,
	},
	content: {
		paddingBottom: 24,
	},
	dot: {
		borderRadius: 999,
		height: 10,
		width: 10,
	},
	footer: {
		paddingBottom: IS_IOS ? 44 : 48,
		paddingHorizontal: IS_IOS ? 20 : 24,
		paddingTop: 12,
	},
	nameCell: {
		borderCurve: "continuous",
		borderRadius: 26,
		marginHorizontal: 16,
		minHeight: 52,
		justifyContent: "center",
		paddingHorizontal: 16,
	},
	nameInput: {
		fontSize: 17,
		lineHeight: 22,
		paddingVertical: 14,
	},
	pill: {
		alignItems: "center",
		borderRadius: 999,
		flexDirection: "row",
		gap: IS_IOS ? 10 : 12,
		height: IS_IOS ? 44 : 48,
		maxWidth: "90%",
		paddingHorizontal: IS_IOS ? 16 : 18,
	},
	pillName: {
		flexShrink: 1,
		fontSize: IS_IOS ? 17 : 16,
		fontWeight: IS_IOS ? "600" : "500",
		lineHeight: IS_IOS ? 22 : 24,
	},
	previewAndroid: {
		alignItems: "center",
		paddingBottom: 20,
		paddingHorizontal: 16,
		paddingTop: 8,
	},
	previewCard: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: 26,
		marginHorizontal: 16,
		marginTop: 8,
		paddingVertical: 18,
	},
	root: {
		flex: 1,
	},
	scroll: {
		flex: 1,
	},
	swatch: {
		alignItems: "center",
		borderRadius: 999,
		height: IS_IOS ? 30 : 34,
		justifyContent: "center",
		width: IS_IOS ? 30 : 34,
	},
	swatchRing: {
		alignItems: "center",
		borderRadius: 999,
		borderWidth: IS_IOS ? 2.5 : 2,
		height: IS_IOS ? 40 : 48,
		justifyContent: "center",
		width: IS_IOS ? 40 : 48,
	},
	swatches: {
		borderCurve: "continuous",
		borderRadius: 26,
		flexDirection: "row",
		justifyContent: "space-between",
		marginHorizontal: 16,
		paddingHorizontal: 18,
		paddingVertical: 14,
	},
	swatchesAndroid: {
		marginHorizontal: 4,
		paddingVertical: 0,
	},
})
