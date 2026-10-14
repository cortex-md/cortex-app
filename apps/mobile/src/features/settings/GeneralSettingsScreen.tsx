import { useAppStore } from "@cortex/core"
import { useSettingsStore } from "@cortex/settings"

import { FormRow, FormSection, FormToggle, NativeForm } from "@/components/ui/Form"
import { updateSetting } from "@/features/settings/settingsPages"

export function GeneralSettingsScreen() {
	const version = useAppStore((state) => state.version)
	const autoOpenLastVault = useSettingsStore((state) => state.settings.general.autoOpenLastVault)

	return (
		<NativeForm>
			<FormSection title="Startup">
				<FormToggle
					onValueChange={(value) => updateSetting("general", "autoOpenLastVault", value)}
					title="Open last vault on startup"
					value={autoOpenLastVault}
				/>
			</FormSection>
			<FormSection title="About">
				<FormRow title="Version" value={version ?? "0.2.0"} />
			</FormSection>
		</NativeForm>
	)
}
