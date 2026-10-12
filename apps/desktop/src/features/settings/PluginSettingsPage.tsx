import { type RegisteredSettingsPage, usePluginStore } from "@cortex/plugin-host-core"
import { runInMainWindow } from "../../windows/runInMainWindow"
import { PluginSettingsRenderer } from "../plugins/rendering/PluginSettingsRenderer"
import { desktopSettingsControls } from "./desktopSettingsControls"
import { SettingsPage, SettingsSection } from "./SettingsPrimitives"

export function PluginSettingsPage({ page }: { page: RegisteredSettingsPage }) {
	const values = usePluginStore((state) => state.settingsValues[page.owner])
	if (!page.schema) return null
	return (
		<SettingsPage>
			<SettingsSection
				title={page.label}
				description="Settings declared by this plugin for the current vault."
			>
				<PluginSettingsRenderer
					schema={page.schema}
					values={values ?? {}}
					controls={desktopSettingsControls}
					fieldIdPrefix={`plugin:${page.owner}.`}
					onUpdate={(key, value) =>
						runInMainWindow("setPluginSetting", { pluginId: page.owner, key, value })
					}
				/>
			</SettingsSection>
		</SettingsPage>
	)
}
