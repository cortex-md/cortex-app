import type { GeneralSettings } from "@cortex/settings"
import { Switch } from "@cortex/ui"
import type { UpdateSettingFn } from "."
import { AccountSection } from "./general/AccountSection"
import { UpdatesSection } from "./general/UpdatesSection"
import { SettingsField, SettingsGroup, SettingsPage, SettingsSection } from "./SettingsPrimitives"

interface GeneralSectionProps {
	settings: GeneralSettings
	onUpdate: UpdateSettingFn
}

export function GeneralSection({ settings, onUpdate }: GeneralSectionProps) {
	return (
		<SettingsPage>
			<AccountSection />
			<SettingsSection
				title="Startup"
				description="Choose what Cortex opens when the app launches."
			>
				<SettingsGroup>
					<SettingsField fieldId="general.auto-open-vault" htmlFor="auto-open-vault">
						<Switch
							id="auto-open-vault"
							checked={settings.autoOpenLastVault}
							onCheckedChange={(checked) => onUpdate("general", "autoOpenLastVault", checked)}
						/>
					</SettingsField>
				</SettingsGroup>
			</SettingsSection>
			<UpdatesSection />
		</SettingsPage>
	)
}
