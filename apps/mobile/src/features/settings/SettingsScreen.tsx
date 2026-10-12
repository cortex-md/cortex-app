import { reportAppError } from "@cortex/core"
import { type AppearanceSettings, type AppSettings, useSettingsStore } from "@cortex/settings"
import { FieldGroup, Host, ListItem, Picker, Slider, Switch } from "@expo/ui"
import { ScrollView, StyleSheet } from "react-native"

import { PluginsSettingsSection } from "@/features/settings/PluginsSettings"
import { useMobileColors } from "@/hooks/useMobileColors"

const colorSchemeOptions: { label: string; value: AppearanceSettings["colorscheme"] }[] = [
	{ label: "System", value: "system" },
	{ label: "Light", value: "light" },
	{ label: "Dark", value: "dark" },
]

function updateSetting<K extends keyof AppSettings>(
	section: K,
	key: keyof AppSettings[K],
	value: unknown,
): void {
	void useSettingsStore
		.getState()
		.updateSetting(section, key, value)
		.catch((cause: unknown) =>
			reportAppError({
				operation: "update-setting",
				source: "mobile-settings",
				cause,
				userMessage: "Unable to save this setting.",
			}),
		)
}

export function SettingsScreen() {
	const { colors } = useMobileColors()
	const { appearance, editor, general } = useSettingsStore((state) => state.settings)

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
			style={{ backgroundColor: colors.background }}
		>
			<Host>
				<FieldGroup>
					<FieldGroup.Section title="General">
						<ListItem
							trailing={
								<Switch
									label="Open last vault on startup"
									onValueChange={(value) => updateSetting("general", "autoOpenLastVault", value)}
									value={general.autoOpenLastVault}
								/>
							}
						>
							Open last vault on startup
						</ListItem>
					</FieldGroup.Section>

					<FieldGroup.Section title="Appearance">
						<ListItem
							trailing={
								<Picker
									onValueChange={(value) => updateSetting("appearance", "colorscheme", value)}
									selectedValue={appearance.colorscheme}
								>
									{colorSchemeOptions.map((option) => (
										<Picker.Item key={option.value} label={option.label} value={option.value} />
									))}
								</Picker>
							}
						>
							Color scheme
						</ListItem>
						<ListItem supportingText={`${appearance.editorFontSize}px`}>Editor font size</ListItem>
						<Slider
							max={24}
							min={10}
							onValueChange={(value) =>
								updateSetting("appearance", "editorFontSize", Math.round(value))
							}
							step={1}
							value={appearance.editorFontSize}
						/>
					</FieldGroup.Section>

					<FieldGroup.Section title="Editor">
						<ListItem
							trailing={
								<Switch
									label="Word wrap"
									onValueChange={(value) => updateSetting("editor", "wordWrap", value)}
									value={editor.wordWrap}
								/>
							}
						>
							Word wrap
						</ListItem>
						<ListItem
							trailing={
								<Switch
									label="Line numbers"
									onValueChange={(value) => updateSetting("editor", "showLineNumbers", value)}
									value={editor.showLineNumbers}
								/>
							}
						>
							Line numbers
						</ListItem>
						<ListItem
							trailing={
								<Switch
									label="Slash commands"
									onValueChange={(value) => updateSetting("editor", "slashCommands", value)}
									value={editor.slashCommands}
								/>
							}
						>
							Slash commands
						</ListItem>
					</FieldGroup.Section>

					<PluginsSettingsSection />
				</FieldGroup>
			</Host>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: 12,
		paddingVertical: 16,
	},
})
