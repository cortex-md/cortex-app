import { Button } from "@cortex/ui"
import { UploadIcon } from "lucide-react"
import { useState } from "react"
import { importFilesFromDialog } from "../import-export/importExportActions"
import { SettingsField, SettingsGroup, SettingsPage, SettingsSection } from "./SettingsPrimitives"

export function ImportExportSection() {
	const [importing, setImporting] = useState(false)

	const handleImport = async () => {
		setImporting(true)
		try {
			await importFilesFromDialog("settings")
		} finally {
			setImporting(false)
		}
	}

	return (
		<SettingsPage>
			<SettingsSection title="Import" description="Bring external documents into this vault.">
				<SettingsGroup>
					<SettingsField
						label="Batch import"
						description="CSV, HTML, and PDF files are imported in parallel."
					>
						<Button type="button" onClick={() => void handleImport()} disabled={importing}>
							<UploadIcon />
							{importing ? "Importing..." : "Import files"}
						</Button>
					</SettingsField>
				</SettingsGroup>
			</SettingsSection>
		</SettingsPage>
	)
}
