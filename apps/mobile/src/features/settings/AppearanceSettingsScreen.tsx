import { useSettingsStore } from "@cortex/settings"
import { useMemo } from "react"
import { Platform } from "react-native"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { openSettings } from "@/features/navigation/routes"
import {
	SCHEME_OPTIONS,
	schemeToSetting,
	settingToScheme,
} from "@/features/settings/appearanceOptions"
import { SettingsPicker, SettingsSlider } from "@/features/settings/SettingsControls"
import type { SettingsOption } from "@/features/settings/settingsControlTypes"
import { updateSetting } from "@/features/settings/settingsPages"
import { useActiveTheme } from "@/hooks/useActiveTheme"
import { useMobileColors } from "@/hooks/useMobileColors"
import type { MobileColors } from "@/theme/colors"

const CUSTOM_ACCENT = "custom"
const TEXT_SIZE_FOOTER =
	Platform.OS === "ios"
		? "Interface text follows the text size in iOS Settings."
		: "Interface text follows the font size in Android Settings."

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

export function AppearanceSettingsScreen() {
	const { colors } = useMobileColors()
	const theme = useActiveTheme()
	const appearance = useSettingsStore((state) => state.settings.appearance)
	const swatches = useMemo(
		() => buildSwatches(colors, theme.tokens.primitive.mist?.["700"] ?? colors.tertiaryLabel),
		[colors, theme],
	)
	const accent =
		swatches.find((swatch) => swatch.color.toLowerCase() === appearance.accentColor.toLowerCase())
			?.label ?? CUSTOM_ACCENT
	const accentOptions: SettingsOption<string>[] = [
		...swatches.map((swatch) => ({ label: swatch.label, value: swatch.label })),
		...(accent === CUSTOM_ACCENT ? [{ label: "Custom", value: CUSTOM_ACCENT }] : []),
	]

	return (
		<NativeForm>
			<FormSection title="Theme">
				<SettingsPicker
					onChange={(value) => updateSetting("appearance", "colorscheme", schemeToSetting[value])}
					options={SCHEME_OPTIONS}
					segmented
					title="Theme"
					value={settingToScheme[appearance.colorscheme]}
				/>
				<FormRow
					onPress={() => openSettings("marketplace", { tab: "themes" })}
					tint
					title="Browse themes"
				/>
			</FormSection>
			<FormSection footer={TEXT_SIZE_FOOTER} title="Interface">
				<SettingsPicker
					onChange={(label) => {
						const swatch = swatches.find((item) => item.label === label)
						if (swatch) updateSetting("appearance", "accentColor", swatch.color)
					}}
					options={accentOptions}
					title="Accent color"
					value={accent}
				/>
				<FormRow title="Font" value={appearance.uiFontFamily} />
			</FormSection>
			<FormSection title="Editor">
				<FormRow title="Font" value={appearance.editorFontFamily} />
				<SettingsSlider
					max={24}
					min={12}
					onChange={(value) => updateSetting("appearance", "editorFontSize", value)}
					title="Font size"
					value={appearance.editorFontSize}
					valueLabel={`${appearance.editorFontSize} px`}
				/>
			</FormSection>
		</NativeForm>
	)
}
