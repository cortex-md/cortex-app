import { reportAppError } from "@cortex/core"
import type { FontInfo } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import type { AppearanceSettings } from "@cortex/settings"
import { getThemeManager, type ThemeFamily, type ThemeTokens } from "@cortex/theme"
import {
	Button,
	ColorPicker,
	type ColorPickerOption,
	NativeSelect,
	NativeSelectOption,
	SimpleTooltip,
	Slider,
	Switch,
} from "@cortex/ui"
import { RefreshCw, Store } from "lucide-react"
import { useEffect, useState } from "react"
import type { OpenMarketplaceHandler } from "../marketplace/openMarketplaceView"
import type { UpdateSettingFn } from "."
import { applyAppearanceSettings, buildAppearanceOverrides } from "./applyAppearance"
import { SettingsField, SettingsGroup, SettingsPage, SettingsSection } from "./SettingsPrimitives"

interface AppearanceSectionProps {
	settings: AppearanceSettings
	onUpdate: UpdateSettingFn
	onBrowseMarketplace: OpenMarketplaceHandler
}

function uniqueColorOptions(options: ColorPickerOption[]): ColorPickerOption[] {
	const seen = new Set<string>()
	return options.filter((option) => {
		const value = option.value.toLowerCase()
		if (seen.has(value)) return false
		seen.add(value)
		return true
	})
}

function buildAccentColorOptions(): ColorPickerOption[] {
	const tokens = getThemeManager().getActiveTheme().tokens as Partial<ThemeTokens>
	const semantic = tokens.semantic
	const status = tokens.status

	if (!semantic || !status) return [{ value: "#fb7185", label: "Default accent" }]

	return uniqueColorOptions([
		{ value: semantic.accent.default, label: "Theme accent" },
		{ value: status.success, label: "Success" },
		{ value: status.warning, label: "Warning" },
		{ value: status.error, label: "Error" },
		{ value: semantic.syntax.string, label: "String" },
		{ value: semantic.syntax.function, label: "Function" },
		{ value: semantic.syntax.property, label: "Property" },
		{ value: semantic.text.muted, label: "Muted" },
	])
}

function restartApp() {
	void getPlatform().window.restartApp()
}

function applyAppearanceSafely(nextAppearance: AppearanceSettings) {
	void applyAppearanceSettings(nextAppearance).catch((error) => {
		void reportAppError({
			operation: "apply-appearance-settings",
			source: "appearance-settings",
			cause: error,
		})
	})
}

interface FontSizeSliderProps {
	id: string
	min: number
	max: number
	value: number
	onPreview: (size: number) => void
	onCommit: (size: number) => void
}

function FontSizeSlider({ id, min, max, value, onPreview, onCommit }: FontSizeSliderProps) {
	const [draft, setDraft] = useState<number | null>(null)
	return (
		<div className="flex items-center gap-3 flex-1">
			<Slider
				id={id}
				min={min}
				max={max}
				value={[draft ?? value]}
				onValueChange={([size]: number[]) => {
					setDraft(size)
					onPreview(size)
				}}
				onValueCommit={([size]: number[]) => {
					setDraft(null)
					onCommit(size)
				}}
				className="flex-1 h-1 accent-color-accent"
			/>
			<span className="text-[11px] text-text-muted min-w-[36px] text-right font-family-mono">
				{draft ?? value}px
			</span>
		</div>
	)
}

export function AppearanceSection({
	settings,
	onUpdate,
	onBrowseMarketplace,
}: AppearanceSectionProps) {
	const [systemFonts, setSystemFonts] = useState<FontInfo[]>([])
	const [fontsLoading, setFontsLoading] = useState(true)
	const [themeFamilies, setThemeFamilies] = useState<ThemeFamily[]>(() =>
		getThemeManager().getThemeFamilies(),
	)
	const [accentColorOptions, setAccentColorOptions] =
		useState<ColorPickerOption[]>(buildAccentColorOptions)
	const [nativeWindowEffectsRestartPending, setNativeWindowEffectsRestartPending] = useState(false)
	const selectedThemeFamily = themeFamilies.find((family) => family.name === settings.theme)
	const canOpenSelectedThemeInMarketplace =
		Boolean(selectedThemeFamily) && selectedThemeFamily?.name !== "default"

	useEffect(() => {
		getPlatform()
			.font.listSystemFonts()
			.then(setSystemFonts)
			.finally(() => setFontsLoading(false))
		const themeManager = getThemeManager()
		const refreshThemeOptions = () => {
			setThemeFamilies(themeManager.getThemeFamilies())
			setAccentColorOptions(buildAccentColorOptions())
		}
		const unsubscribe = themeManager.subscribe(() => {
			refreshThemeOptions()
		})
		return unsubscribe
	}, [])

	const applyOverrides = (partial: Partial<AppearanceSettings>) => {
		getThemeManager().applyOverrides(buildAppearanceOverrides({ ...settings, ...partial }))
	}

	const handleThemeChange = (theme: string) => {
		onUpdate("appearance", "theme", theme)
		applyAppearanceSafely({ ...settings, theme })
		setAccentColorOptions(buildAccentColorOptions())
	}

	const handleColorschemeChange = (colorscheme: "light" | "dark" | "system") => {
		onUpdate("appearance", "colorscheme", colorscheme)
		applyAppearanceSafely({ ...settings, colorscheme })
		setAccentColorOptions(buildAccentColorOptions())
	}

	const handleAccentColorChange = (hex: string) => {
		onUpdate("appearance", "accentColor", hex)
		applyOverrides({ accentColor: hex })
	}

	const handleUIFontFamilyChange = (fontFamily: string) => {
		onUpdate("appearance", "uiFontFamily", fontFamily)
		applyOverrides({ uiFontFamily: fontFamily })
	}

	const handleUIFontSizeChange = (size: number) => {
		onUpdate("appearance", "uiFontSize", size)
	}

	const handleNativeWindowEffectsChange = async (enabled: boolean) => {
		await onUpdate("appearance", "nativeWindowEffects", enabled)
		setNativeWindowEffectsRestartPending(true)
	}

	const handleShowRibbonChange = (visible: boolean) => {
		onUpdate("appearance", "showRibbon", visible)
	}

	const handleEditorFontFamilyChange = (fontFamily: string) => {
		onUpdate("appearance", "editorFontFamily", fontFamily)
		applyOverrides({ editorFontFamily: fontFamily })
	}

	const handleEditorFontSizeChange = (size: number) => {
		onUpdate("appearance", "editorFontSize", size)
	}

	const handleOpenSelectedThemeInMarketplace = () => {
		if (!selectedThemeFamily || selectedThemeFamily.name === "default") return
		onBrowseMarketplace("themes", { selectedEntryId: selectedThemeFamily.name })
	}

	return (
		<SettingsPage>
			<SettingsSection
				title="Theme"
				description="Choose the active theme, color scheme, and accent color."
				action={
					<Button variant="ghost" onClick={() => onBrowseMarketplace("themes")}>
						<Store size={12} />
						Browse themes
					</Button>
				}
			>
				<SettingsGroup>
					<SettingsField fieldId="appearance.theme" htmlFor="theme">
						<div className="settings-theme-marketplace-control">
							<NativeSelect
								id="theme"
								value={settings.theme}
								onChange={(e) => handleThemeChange(e.target.value)}
							>
								{themeFamilies.map((family) => (
									<NativeSelectOption key={family.name} value={family.name}>
										{family.displayName}
									</NativeSelectOption>
								))}
							</NativeSelect>
							<SimpleTooltip
								label={canOpenSelectedThemeInMarketplace ? undefined : "Built-in theme"}
							>
								<span className="inline-flex">
									<Button
										variant="ghost"
										disabled={!canOpenSelectedThemeInMarketplace}
										onClick={handleOpenSelectedThemeInMarketplace}
									>
										<Store size={12} />
										View
									</Button>
								</span>
							</SimpleTooltip>
						</div>
					</SettingsField>

					<SettingsField fieldId="appearance.colorscheme" htmlFor="colorscheme">
						<NativeSelect
							id="colorscheme"
							value={settings.colorscheme}
							onChange={(e) =>
								handleColorschemeChange(e.target.value as "light" | "dark" | "system")
							}
						>
							<NativeSelectOption value="light">Light</NativeSelectOption>
							<NativeSelectOption value="dark">Dark</NativeSelectOption>
							<NativeSelectOption value="system">System</NativeSelectOption>
						</NativeSelect>
					</SettingsField>

					<SettingsField
						fieldId="appearance.accent-color"
						htmlFor="accent-color"
						controlClassName="max-w-[280px]"
					>
						<ColorPicker
							customInputId="accent-color"
							value={settings.accentColor}
							options={accentColorOptions}
							allowClear={false}
							customLabel="Accent Color"
							onChange={(color) => {
								if (color) handleAccentColorChange(color)
							}}
							className="max-w-[240px] items-end"
						/>
					</SettingsField>
				</SettingsGroup>
			</SettingsSection>

			<SettingsSection
				title="Interface"
				description="Tune the app chrome and navigation typography."
			>
				<SettingsGroup>
					<SettingsField
						fieldId="appearance.ui-font"
						htmlFor="ui-font-family"
						description={fontsLoading ? "Loading system fonts..." : undefined}
					>
						<NativeSelect
							id="ui-font-family"
							value={settings.uiFontFamily}
							disabled={fontsLoading}
							onChange={(e) => handleUIFontFamilyChange(e.target.value)}
						>
							<NativeSelectOption value="System Default">System Default</NativeSelectOption>
							{systemFonts.map((font) => (
								<NativeSelectOption key={font.family} value={font.family}>
									{font.family}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</SettingsField>

					<SettingsField
						fieldId="appearance.ui-font-size"
						htmlFor="ui-font-size"
						controlClassName="max-w-[420px]"
					>
						<FontSizeSlider
							id="ui-font-size"
							min={10}
							max={20}
							value={settings.uiFontSize}
							onPreview={(size) => applyOverrides({ uiFontSize: size })}
							onCommit={handleUIFontSizeChange}
						/>
					</SettingsField>

					<SettingsField fieldId="appearance.native-window-effects" htmlFor="native-window-effects">
						<div className="flex items-center gap-3">
							{nativeWindowEffectsRestartPending && (
								<Button variant="outline" onClick={restartApp}>
									<RefreshCw size={12} />
									Restart now
								</Button>
							)}
							<Switch
								id="native-window-effects"
								checked={settings.nativeWindowEffects}
								onCheckedChange={handleNativeWindowEffectsChange}
							/>
						</div>
					</SettingsField>

					<SettingsField fieldId="appearance.show-ribbon" htmlFor="show-ribbon">
						<Switch
							id="show-ribbon"
							checked={settings.showRibbon}
							onCheckedChange={handleShowRibbonChange}
						/>
					</SettingsField>
				</SettingsGroup>
			</SettingsSection>

			<SettingsSection title="Editor" description="Tune note editing typography.">
				<SettingsGroup>
					<SettingsField
						fieldId="appearance.editor-font"
						htmlFor="editor-font-family"
						description={fontsLoading ? "Loading system fonts..." : undefined}
					>
						<NativeSelect
							id="editor-font-family"
							value={settings.editorFontFamily}
							disabled={fontsLoading}
							onChange={(e) => handleEditorFontFamilyChange(e.target.value)}
						>
							<NativeSelectOption value="System Default">System Default</NativeSelectOption>
							{systemFonts.map((font) => (
								<NativeSelectOption key={font.family} value={font.family}>
									{font.family}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</SettingsField>

					<SettingsField
						fieldId="appearance.editor-font-size"
						htmlFor="editor-font-size"
						controlClassName="max-w-[420px]"
					>
						<FontSizeSlider
							id="editor-font-size"
							min={12}
							max={24}
							value={settings.editorFontSize}
							onPreview={(size) => applyOverrides({ editorFontSize: size })}
							onCommit={handleEditorFontSizeChange}
						/>
					</SettingsField>
				</SettingsGroup>
			</SettingsSection>
		</SettingsPage>
	)
}
