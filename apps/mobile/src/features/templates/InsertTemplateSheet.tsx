import type { TemplateDefinition } from "@cortex/core"
import { isTeamTemplate } from "@cortex/templates"
import { Stack, useLocalSearchParams } from "expo-router"
import { useMemo, useState } from "react"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import { CLOSE_ICON, HeaderActions } from "@/features/importExport/HeaderActions"
import { dismissSheet } from "@/features/navigation/routes"
import { insertTemplateIntoNote } from "@/features/templates/insertTemplate"
import {
	TEAM_GROUP_FALLBACK,
	toNoteEntry,
	useVaultTemplates,
} from "@/features/templates/templatesAdapter"

function readParam(value: string | string[] | undefined): string | null {
	const resolved = Array.isArray(value) ? value[0] : value
	return resolved ? resolved : null
}

export function InsertTemplateSheet() {
	const params = useLocalSearchParams<{ filePath?: string | string[] }>()
	const filePath = readParam(params.filePath)
	const { loading, templates, vault } = useVaultTemplates()
	const [insertingId, setInsertingId] = useState<string | null>(null)

	const groups = useMemo(() => {
		const local = templates.filter((template) => !isTeamTemplate(template))
		const team = templates.filter((template) => isTeamTemplate(template))
		const teamGroup = team[0]?.remote?.group ?? TEAM_GROUP_FALLBACK
		return { local, team, teamGroup }
	}, [templates])

	function insert(template: TemplateDefinition) {
		if (!vault || !filePath || insertingId) return
		setInsertingId(template.id)
		void insertTemplateIntoNote(vault, template, filePath).then((inserted) => {
			setInsertingId(null)
			if (inserted) dismissSheet()
		})
	}

	function rows(list: TemplateDefinition[]) {
		if (!vault) return null
		return list.map((template) => (
			<FormRow
				disabled={insertingId !== null}
				icon={toNoteEntry(template, vault).icon}
				key={template.id}
				onPress={() => insert(template)}
				subtitle={insertingId === template.id ? "Inserting…" : undefined}
				title={template.name}
			/>
		))
	}

	const empty = !loading && groups.local.length === 0 && groups.team.length === 0
	const footer = empty
		? "No templates yet. Create them in Settings → Templates."
		: "Properties are merged, never overwritten."

	return (
		<>
			<Stack.Screen options={{ title: "Insert template" }} />
			<HeaderActions left={{ icon: CLOSE_ICON, label: "Close", onPress: dismissSheet }} />
			<NativeForm>
				{groups.local.length > 0 ? (
					<FormSection footer={groups.team.length > 0 ? undefined : footer} title="In this vault">
						{rows(groups.local)}
					</FormSection>
				) : null}
				{groups.team.length > 0 ? (
					<FormSection footer={footer} title={`From ${groups.teamGroup}`}>
						{rows(groups.team)}
					</FormSection>
				) : null}
				{empty ? <FormSection footer={footer}>{null}</FormSection> : null}
			</NativeForm>
		</>
	)
}
