import { type AppearanceSettings, useSettingsStore } from "@cortex/settings"
import { Host, Slider } from "@expo/ui"
import { Check } from "lucide-react-native"
import { useMemo } from "react"
import { Platform, Pressable, StyleSheet, Text, View } from "react-native"

import { SegmentedControl } from "@/components/ui/SegmentedControl"
import type { SegmentedOption } from "@/components/ui/segmentedTypes"
import { SettingsRow } from "@/components/ui/SettingsRow"
import { openSettings } from "@/features/navigation/routes"
import {
	SettingsBlock,
	SettingsFooter,
	SettingsScroll,
	SettingsSection,
} from "@/features/settings/SettingsLayout"
import { updateSetting } from "@/features/settings/settingsPages"
import { useActiveTheme } from "@/hooks/useActiveTheme"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"

const IS_IOS = Platform.OS === "ios"

type SchemeOption = "paper" | "ink" | "system"

const schemeOptions: SegmentedOption<SchemeOption>[] = [
	{ label: "Paper", value: "paper" },
	{ label: "Ink", value: "ink" },
	{ label: "System", value: "system" },
]

const schemeToSetting: Record<SchemeOption, AppearanceSettings["colorscheme"]> = {
	ink: "dark",
	paper: "light",
	system: "system",
}

const settingToScheme: Record<AppearanceSettings["colorscheme"], SchemeOption> = {
	dark: "ink",
	light: "paper",
	system: "system",
}

const themeLabels: Record<SchemeOption, string> = {
	ink: "Ink (Dark)",
	paper: "Paper (Light)",
	system: "System",
}

interface AccentSwatch {
	label: string
	color: string
}

function buildSwatches(colors: MobileColors, graphite: string): AccentSwatch[] {
	return [
		{ label: "Rose", color: colors.tintFill },
		{ label: "Blue", color: colors.headingBlue },
		{ label: "Green", color: colors.swatchGreen },
		{ label: "Yellow", color: colors.swatchYellow },
		{ label: "Violet", color: colors.headingViolet },
		{ label: "Red", color: colors.swatchRed },
		{ label: "Graphite", color: graphite },
	]
}

function openThemes(): void {
	openSettings("marketplace", { tab: "themes" })
}

function AccentSwatches({
	onSelect,
	selected,
	swatches,
}: {
	onSelect: (color: string) => void
	selected: string
	swatches: AccentSwatch[]
}) {
	const { colors } = useMobileColors()
	return (
		<View style={[styles.swatchRow, { backgroundColor: colors.cell }]}>
			{swatches.map((swatch) => {
				const active = swatch.color.toLowerCase() === selected.toLowerCase()
				return (
					<Pressable
						accessibilityLabel={swatch.label}
						accessibilityRole="radio"
						accessibilityState={{ selected: active }}
						key={swatch.label}
						onPress={() => onSelect(swatch.color)}
						style={styles.swatchHit}
					>
						<View
							style={[
								styles.swatchRing,
								{ borderColor: active ? colors.tint : "transparent" },
							]}
						>
							<View style={[styles.swatch, { backgroundColor: swatch.color }]}>
								{active && !IS_IOS ? (
									<Check color={colors.onTint} size={16} strokeWidth={3} />
								) : null}
							</View>
						</View>
					</Pressable>
				)
			})}
		</View>
	)
}

function FontSizeSlider({ onChange, value }: { onChange: (value: number) => void; value: number }) {
	const { colors } = useMobileColors()
	return (
		<View style={[styles.sliderRow, { backgroundColor: colors.cell }]}>
			{IS_IOS ? <Text style={[styles.glyphSmall, { color: colors.secondaryLabel }]}>A</Text> : null}
			<Host matchContents style={styles.sliderHost}>
				<Slider max={24} min={12} onValueChange={(next) => onChange(Math.round(next))} step={1} value={value} />
			</Host>
			{IS_IOS ? <Text style={[styles.glyphLarge, { color: colors.secondaryLabel }]}>A</Text> : null}
		</View>
	)
}

export function AppearanceSettingsScreen() {
	const { colors } = useMobileColors()
	const theme = useActiveTheme()
	const appearance = useSettingsStore((state) => state.settings.appearance)
	const scheme = settingToScheme[appearance.colorscheme]
	const swatches = useMemo(
		() => buildSwatches(colors, theme.tokens.primitive.mist?.["700"] ?? colors.tertiaryLabel),
		[colors, theme],
	)

	return (
		<SettingsScroll>
			<SettingsBlock>
				<Text style={[styles.sectionTitle, { color: IS_IOS ? colors.secondaryLabel : colors.tint }]}>
					{IS_IOS ? "THEME" : "Theme"}
				</Text>
				<SegmentedControl
					accessibilityLabel="Color scheme"
					onChange={(value) => updateSetting("appearance", "colorscheme", schemeToSetting[value])}
					options={schemeOptions}
					style={styles.segmented}
					value={scheme}
				/>
				<SettingsSection>
					<SettingsRow chevron onPress={openThemes} title="Theme" value={themeLabels[scheme]} />
					<SettingsRow onPress={openThemes} tint title="Browse themes" />
				</SettingsSection>
			</SettingsBlock>

			<SettingsBlock>
				<Text style={[styles.sectionTitle, { color: IS_IOS ? colors.secondaryLabel : colors.tint }]}>
					{IS_IOS ? "ACCENT COLOR" : "Accent color"}
				</Text>
				<AccentSwatches
					onSelect={(color) => updateSetting("appearance", "accentColor", color)}
					selected={appearance.accentColor}
					swatches={swatches}
				/>
			</SettingsBlock>

			<SettingsBlock>
				<SettingsSection title="Interface">
					<SettingsRow title="UI font" value={appearance.uiFontFamily} />
				</SettingsSection>
				<SettingsFooter>
					{IS_IOS
						? "Interface text follows the iOS text size in Settings › Display & Brightness."
						: "Interface text follows the Android font size in Settings › Display."}
				</SettingsFooter>
			</SettingsBlock>

			<SettingsBlock>
				<SettingsSection title="Editor">
					<SettingsRow title="Editor font" value={appearance.editorFontFamily} />
					<SettingsRow title="Editor font size" value={`${appearance.editorFontSize}px`} />
				</SettingsSection>
				<FontSizeSlider
					onChange={(value) => updateSetting("appearance", "editorFontSize", value)}
					value={appearance.editorFontSize}
				/>
			</SettingsBlock>
		</SettingsScroll>
	)
}

const styles = StyleSheet.create({
	glyphLarge: {
		fontSize: 22,
		lineHeight: 26,
	},
	glyphSmall: {
		fontSize: 13,
		lineHeight: 18,
	},
	sectionTitle: {
		fontSize: IS_IOS ? 13 : 14,
		fontWeight: IS_IOS ? "400" : "500",
		letterSpacing: IS_IOS ? 0 : 0.1,
		lineHeight: IS_IOS ? 18 : 20,
		marginBottom: 8,
		marginHorizontal: 32,
		marginTop: 12,
	},
	segmented: {
		marginBottom: 4,
		marginHorizontal: 16,
	},
	sliderHost: {
		flex: 1,
	},
	sliderRow: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		flexDirection: "row",
		gap: 12,
		marginHorizontal: 16,
		marginTop: 8,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	swatch: {
		alignItems: "center",
		borderRadius: 999,
		height: 30,
		justifyContent: "center",
		width: 30,
	},
	swatchHit: {
		alignItems: "center",
		justifyContent: "center",
		minHeight: 44,
		minWidth: 44,
	},
	swatchRing: {
		borderRadius: 999,
		borderWidth: 2.5,
		padding: 2,
	},
	swatchRow: {
		alignItems: "center",
		borderCurve: "continuous",
		borderRadius: IS_IOS ? 26 : 20,
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "space-between",
		marginHorizontal: 16,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
})
