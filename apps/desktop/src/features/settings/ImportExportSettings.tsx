import { Button } from "@cortex/ui"
import { UploadIcon } from "lucide-react"
import { runInMainWindow } from "../../windows/runInMainWindow"
import { SettingsField, SettingsGroup, SettingsPage, SettingsSection } from "./SettingsPrimitives"

export function ImportExportSection() {
	return (
		<SettingsPage>
			<SettingsSection title="Import" description="Bring external documents into this vault.">
				<SettingsGroup>
					<SettingsField fieldId="import-export.batch-import">
						<Button type="button" onClick={() => runInMainWindow("importFiles")}>
							<UploadIcon />
							Import files
						</Button>
					</SettingsField>
				</SettingsGroup>
			</SettingsSection>
		</SettingsPage>
	)
}
