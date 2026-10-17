import { getErrorMessage, type TemplateVault, useTemplateStore } from "@cortex/core"
import { isTeamTemplate } from "@cortex/core/templates"
import { useMemo, useState } from "react"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { TextPromptDialog } from "@/components/ui/TextPromptDialog"
import { toast } from "@/features/feedback/useToast"
import { openSettings, openTemplateEditor } from "@/features/navigation/routes"
import { DailyNotesSection } from "@/features/templates/DailyNotesSection"
import {
	getTemplateBodyFilePath,
	TEAM_GROUP_FALLBACK,
	toNoteEntry,
	useTeamDatabaseTemplates,
	useVaultTemplates,
} from "@/features/templates/templatesAdapter"

async function createTemplate(vault: TemplateVault, name: string): Promise<void> {
	try {
		const template = await useTemplateStore.getState().createTemplate(vault, {
			askName: true,
			body: "",
			fileNamePattern: "{{ note.title }}",
			name,
		})
		openTemplateEditor(getTemplateBodyFilePath(vault.path, template))
	} catch (error) {
		toast(getErrorMessage(error))
	}
}

export function TemplatesSettingsScreen() {
	const { loading, templates, vault } = useVaultTemplates()
	const databases = useTeamDatabaseTemplates()
	const [naming, setNaming] = useState(false)

	const { local, team, teamGroup } = useMemo(() => {
		const teamTemplates = templates.filter((template) => isTeamTemplate(template))
		return {
			local: templates
				.filter((template) => !isTeamTemplate(template))
				.sort((a, b) => a.name.localeCompare(b.name)),
			team: teamTemplates,
			teamGroup:
				teamTemplates[0]?.remote?.group ?? databases[0]?.meta?.groupName ?? TEAM_GROUP_FALLBACK,
		}
	}, [databases, templates])

	const localFooter =
		local.length === 0 && !loading
			? "New notes start from a template’s properties and headings."
			: undefined

	return (
		<>
			<NativeForm>
				<FormSection footer={localFooter} title="In this vault">
					{vault
						? local.map((template) => (
								<FormRow
									chevron
									icon={{ md: "dashboard", sf: "doc.text" }}
									key={template.id}
									onPress={() => openTemplateEditor(getTemplateBodyFilePath(vault.path, template))}
									subtitle={toNoteEntry(template, vault).hint || undefined}
									title={template.name}
								/>
							))
						: null}
					<FormRow
						disabled={!vault}
						icon={{ md: "add", sf: "plus" }}
						onPress={() => setNaming(true)}
						tint
						title="New template"
					/>
				</FormSection>
				{team.length > 0 || databases.length > 0 ? (
					<FormSection footer={`Shared by people in ${teamGroup}.`} title={`From ${teamGroup}`}>
						{vault
							? team.map((template) => (
									<FormRow
										key={template.id}
										subtitle={toNoteEntry(template, vault).hint || undefined}
										title={template.name}
									/>
								))
							: null}
						{databases.map((database) => (
							<FormRow
								key={database.id}
								subtitle={database.meta ? `Shared by ${database.meta.ownerName}` : undefined}
								title={database.name}
								value="Database"
							/>
						))}
					</FormSection>
				) : null}
				<DailyNotesSection templates={local} />
				<FormSection>
					<FormRow
						chevron
						icon={{ md: "storefront", sf: "storefront" }}
						onPress={() => openSettings("marketplace", { tab: "templates" })}
						tint
						title="Browse marketplace"
					/>
				</FormSection>
			</NativeForm>
			<TextPromptDialog
				confirmLabel="Create"
				onCancel={() => setNaming(false)}
				onConfirm={(name) => {
					setNaming(false)
					if (vault) void createTemplate(vault, name)
				}}
				placeholder="Template name"
				title="New template"
				visible={naming}
			/>
		</>
	)
}
