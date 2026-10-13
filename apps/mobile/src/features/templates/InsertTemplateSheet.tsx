import type { TemplateDefinition } from "@cortex/core"
import { isTeamTemplate } from "@cortex/templates"
import { useLocalSearchParams } from "expo-router"
import { useMemo, useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"

import { EmptyState } from "@/components/ui/EmptyState"
import { GroupedFooter, GroupedList, GroupedRow } from "@/components/ui/GroupedList"
import { SheetHeader } from "@/components/ui/SheetHeader"
import { dismissSheet } from "@/features/navigation/routes"
import { insertTemplateIntoNote } from "@/features/templates/insertTemplate"
import { TemplateGroupHeader } from "@/features/templates/TemplateFields"
import { toNoteEntry, useVaultTemplates } from "@/features/templates/templatesAdapter"
import { FIXTURE_TEAM_GROUP } from "@/features/templates/templatesFixtures"
import { useMobileColors } from "@/hooks/useMobileColors"

function readParam(value: string | string[] | undefined): string | null {
	const resolved = Array.isArray(value) ? value[0] : value
	return resolved ? resolved : null
}

export function InsertTemplateSheet() {
	const params = useLocalSearchParams<{ filePath?: string | string[] }>()
	const filePath = readParam(params.filePath)
	const { colors } = useMobileColors()
	const { templates, vault } = useVaultTemplates()
	const [insertingId, setInsertingId] = useState<string | null>(null)

	const groups = useMemo(() => {
		const local = templates.filter((template) => !isTeamTemplate(template))
		const team = templates.filter((template) => isTeamTemplate(template))
		const teamGroup = team[0]?.remote?.group ?? FIXTURE_TEAM_GROUP
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

	function renderRows(list: TemplateDefinition[]) {
		if (!vault) return null
		return list.map((template) => {
			const entry = toNoteEntry(template, vault)
			return (
				<GroupedRow
					disabled={insertingId !== null}
					key={template.id}
					onPress={() => insert(template)}
					subtitle={insertingId === template.id ? "Inserting…" : entry.hint || undefined}
					title={template.name}
				/>
			)
		})
	}

	const empty = groups.local.length === 0 && groups.team.length === 0

	return (
		<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
			<SheetHeader onClose={dismissSheet} title="Insert template at cursor" />
			<ScrollView contentContainerStyle={styles.content}>
				{empty ? (
					<EmptyState
						description="Create templates in Settings → Templates."
						title="No templates yet"
					/>
				) : null}
				{groups.local.length > 0 ? (
					<>
						<TemplateGroupHeader title="In this vault" />
						<GroupedList>{renderRows(groups.local)}</GroupedList>
					</>
				) : null}
				{groups.team.length > 0 ? (
					<>
						<TemplateGroupHeader team={groups.teamGroup} title={`From ${groups.teamGroup}`} />
						<GroupedList>{renderRows(groups.team)}</GroupedList>
					</>
				) : null}
				<GroupedFooter>↵ insert · Properties are merged, never overwritten</GroupedFooter>
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 40,
	},
	root: {
		flex: 1,
	},
})
