import {
	getErrorMessage,
	type TemplateDefinition,
	type TemplateVault,
	useTemplateStore,
} from "@cortex/core"
import { isTeamTemplate } from "@cortex/templates"
import { LayoutTemplate, Plus, Store } from "lucide-react-native"
import { useMemo, useState } from "react"
import { Platform, ScrollView, StyleSheet, View } from "react-native"

import { Badge } from "@/components/ui/Badge"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { EmptyState } from "@/components/ui/EmptyState"
import { GroupedFooter, GroupedList, GroupedRow } from "@/components/ui/GroupedList"
import { TextPromptDialog } from "@/components/ui/TextPromptDialog"
import { toast } from "@/features/feedback/useToast"
import { openSettings, openTemplateEditor } from "@/features/navigation/routes"
import { TemplateGroupHeader } from "@/features/templates/TemplateFields"
import {
	getTemplateBodyFilePath,
	toNoteEntry,
	useTeamDatabaseTemplates,
	useVaultTemplates,
} from "@/features/templates/templatesAdapter"
import { FIXTURE_TEAM_GROUP } from "@/features/templates/templatesFixtures"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

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

async function deleteTemplate(vault: TemplateVault, template: TemplateDefinition): Promise<void> {
	try {
		await useTemplateStore.getState().deleteTemplate(vault, template.id)
		toast(`Deleted “${template.name}”`)
	} catch (error) {
		toast(getErrorMessage(error))
	}
}

export function TemplatesSettingsScreen() {
	const { colors } = useMobileColors()
	const { loading, templates, vault } = useVaultTemplates()
	const databases = useTeamDatabaseTemplates()
	const [naming, setNaming] = useState(false)
	const [pendingDelete, setPendingDelete] = useState<TemplateDefinition | null>(null)

	const { local, team, teamGroup } = useMemo(() => {
		const teamTemplates = templates.filter((template) => isTeamTemplate(template))
		return {
			local: templates
				.filter((template) => !isTeamTemplate(template))
				.sort((a, b) => a.name.localeCompare(b.name)),
			team: teamTemplates,
			teamGroup:
				teamTemplates[0]?.remote?.group ?? databases[0]?.meta?.groupName ?? FIXTURE_TEAM_GROUP,
		}
	}, [databases, templates])

	return (
		<ScrollView
			contentContainerStyle={styles.content}
			contentInsetAdjustmentBehavior="automatic"
			style={{ backgroundColor: colors.groupedBackground }}
		>
			<TemplateGroupHeader title="In this vault" />
			{local.length > 0 && vault ? (
				<GroupedList>
					{local.map((template) => (
						<GroupedRow
							chevron
							key={template.id}
							leading={
								IS_IOS ? undefined : (
									<LayoutTemplate color={colors.secondaryLabel} size={24} strokeWidth={2} />
								)
							}
							onLongPress={() => setPendingDelete(template)}
							onPress={() => openTemplateEditor(getTemplateBodyFilePath(vault.path, template))}
							subtitle={toNoteEntry(template, vault).hint || undefined}
							title={template.name}
						/>
					))}
				</GroupedList>
			) : (
				<EmptyState
					Icon={LayoutTemplate}
					description={
						loading ? undefined : "New notes start from a template’s properties and headings."
					}
					title={loading ? "Loading templates" : "No templates yet"}
				/>
			)}
			<View style={styles.block}>
				<GroupedList>
					<GroupedRow
						disabled={!vault}
						leading={<Plus color={colors.tint} size={IS_IOS ? 20 : 24} strokeWidth={2.2} />}
						onPress={() => setNaming(true)}
						tint
						title="New template"
					/>
				</GroupedList>
				<GroupedFooter>Long-press a template to delete it.</GroupedFooter>
			</View>

			{team.length > 0 || databases.length > 0 ? (
				<>
					<TemplateGroupHeader team={teamGroup} title={`From ${teamGroup}`} />
					<GroupedList>
						{vault
							? team.map((template) => (
									<GroupedRow
										key={template.id}
										subtitle={toNoteEntry(template, vault).hint}
										title={template.name}
									/>
								))
							: null}
						{databases.map((database) => (
							<GroupedRow
								key={database.id}
								subtitle={database.meta ? `Shared by ${database.meta.ownerName}` : undefined}
								title={database.name}
								trailing={<Badge label="Database" tint />}
							/>
						))}
					</GroupedList>
					<GroupedFooter>{`Shared by people in ${teamGroup}. They show up in New from template and in /template.`}</GroupedFooter>
				</>
			) : null}

			<View style={styles.block}>
				<GroupedList>
					<GroupedRow
						chevron={IS_IOS}
						leading={<Store color={colors.tint} size={IS_IOS ? 22 : 24} strokeWidth={2} />}
						onPress={() => openSettings("marketplace", { tab: "templates" })}
						tint
						title="Browse marketplace"
					/>
				</GroupedList>
			</View>

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
			<ConfirmDialog
				confirmLabel="Delete"
				destructive
				message="Notes already created from it stay as they are."
				onCancel={() => setPendingDelete(null)}
				onConfirm={() => {
					const template = pendingDelete
					setPendingDelete(null)
					if (vault && template) void deleteTemplate(vault, template)
				}}
				title={`Delete “${pendingDelete?.name ?? ""}”?`}
				visible={pendingDelete !== null}
			/>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	block: {
		marginTop: 18,
	},
	content: {
		paddingBottom: 48,
	},
})
