import { useTemplateStore, useVaultStore } from "@cortex/core"
import { getTeamLabel, isTeamTemplate } from "@cortex/core/templates"
import { useSettingsStore } from "@cortex/settings"
import { Button, Switch } from "@cortex/ui"
import { LayoutTemplateIcon } from "lucide-react"
import { useEffect } from "react"
import { runInMainWindow } from "../../windows/runInMainWindow"
import {
	SettingsField,
	SettingsGroup,
	SettingsPage,
	SettingsSection,
} from "../settings/SettingsPrimitives"
import { DailyNotesSettings } from "./DailyNotesSettings"

function pluralize(count: number, word: string): string {
	return `${count} ${word}${count === 1 ? "" : "s"}`
}

export function TemplatesSection() {
	const vault = useVaultStore((state) => state.vault)
	const templates = useTemplateStore((state) => state.templates)
	const ensureTemplatesLoaded = useTemplateStore((state) => state.ensureTemplatesLoaded)
	const showTeam = useSettingsStore((state) => state.settings.templates.showTeam)
	const updateSetting = useSettingsStore((state) => state.updateSetting)

	useEffect(() => {
		if (vault) void ensureTemplatesLoaded(vault)
	}, [ensureTemplatesLoaded, vault])

	const teamCount = templates.filter(isTeamTemplate).length
	const vaultCount = templates.length - teamCount
	const breakdown =
		teamCount > 0
			? `${vaultCount} in this vault · ${teamCount} ${getTeamLabel(templates).toLowerCase()}`
			: "Saved in this vault"

	return (
		<SettingsPage>
			<section className="settings-section" data-settings-field="templates.list">
				<div className="settings-sync-hero" data-tone="muted" data-compact="">
					<span className="settings-sync-hero-icon">
						<LayoutTemplateIcon />
					</span>
					<div className="settings-sync-hero-copy">
						<b>{pluralize(templates.length, "template")}</b>
						<span>{breakdown}</span>
					</div>
					<div className="settings-sync-hero-actions">
						<Button variant="secondary" onClick={() => runInMainWindow("openNewTemplate")}>
							New template
						</Button>
						<Button onClick={() => runInMainWindow("openTemplates")}>Open Templates</Button>
					</div>
				</div>
			</section>
			<SettingsSection title="Defaults">
				<SettingsGroup>
					<SettingsField fieldId="templates.show-team" htmlFor="templates-show-team">
						<Switch
							id="templates-show-team"
							size="sm"
							checked={showTeam}
							onCheckedChange={(checked) => void updateSetting("templates", "showTeam", checked)}
						/>
					</SettingsField>
				</SettingsGroup>
			</SettingsSection>
			<DailyNotesSettings templates={templates} />
		</SettingsPage>
	)
}
