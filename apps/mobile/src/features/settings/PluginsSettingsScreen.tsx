import { PluginsSettingsSection } from "@/features/settings/PluginsSettings"
import { SettingsIntro, SettingsScroll } from "@/features/settings/SettingsLayout"

export function PluginsSettingsScreen() {
	return (
		<SettingsScroll>
			<SettingsIntro>Manage built-in and community extensions for this vault.</SettingsIntro>
			<PluginsSettingsSection />
		</SettingsScroll>
	)
}
