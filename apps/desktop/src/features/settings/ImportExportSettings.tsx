import { Button } from "@cortex/ui"
import { UploadIcon } from "lucide-react"
import { SettingsField, SettingsGroup, SettingsPage, SettingsSection } from "./SettingsPrimitives"
import { runSettingsAction } from "./settingsActions"

export function ImportExportSection() {
	return (
		<SettingsPage>
			<SettingsSection title="Import" description="Bring external documents into this vault.">
				<SettingsGroup>
					<SettingsField fieldId="import-export.batch-import">
						<Button size="sm" type="button" onClick={() => runSettingsAction("importFiles")}>
							<UploadIcon />
							Import files
						</Button>
					</SettingsField>
					<SettingsField fieldId="import-export.obsidian">
						<Button
							size="sm"
							type="button"
							variant="outline"
							onClick={() => runSettingsAction("importObsidian")}
						>
							<UploadIcon />
							Import from Obsidian
						</Button>
					</SettingsField>
				</SettingsGroup>
			</SettingsSection>
		</SettingsPage>
	)
}
