import { useTemplateStore } from "@cortex/core"
import { useLocalSearchParams } from "expo-router"
import { Plus, SlidersHorizontal, Store, X } from "lucide-react-native"
import { useMemo, useState } from "react"
import { Platform, ScrollView, StyleSheet, View } from "react-native"

import { Badge } from "@/components/ui/Badge"
import { GroupedList, GroupedRow } from "@/components/ui/GroupedList"
import { SearchField } from "@/components/ui/SearchField"
import { dismissSheet, openSettings } from "@/features/navigation/routes"
import { TemplateGroupHeader } from "@/features/templates/TemplateFields"
import { TemplatePreviewStep } from "@/features/templates/TemplatePreviewStep"
import { TemplateSheetHeader } from "@/features/templates/TemplateSheetHeader"
import {
	BLANK_TEMPLATE_ENTRY,
	resolveMarketplaceEntry,
	type TemplateEntry,
	useTeamDatabaseTemplates,
	useTemplateSections,
} from "@/features/templates/templatesAdapter"
import { useMobileColors } from "@/hooks/useMobileColors"

const IS_IOS = Platform.OS === "ios"

type Step = { kind: "list" } | { kind: "preview"; entry: TemplateEntry; initialTitle: string }

function readParam(value: string | string[] | undefined): string | null {
	const resolved = Array.isArray(value) ? value[0] : value
	return resolved ? resolved : null
}

function manageTemplates() {
	dismissSheet()
	openSettings("templates")
}

function browseMarketplace() {
	dismissSheet()
	openSettings("marketplace", { tab: "templates" })
}

function TemplateRow({ entry, onPress }: { entry: TemplateEntry; onPress: () => void }) {
	const { colors } = useMobileColors()
	const Icon = entry.Icon
	return (
		<GroupedRow
			chevron={IS_IOS}
			leading={IS_IOS ? <Icon color={colors.tint} size={22} strokeWidth={2} /> : undefined}
			onPress={onPress}
			subtitle={entry.hint || undefined}
			title={entry.name}
			trailing={entry.kind === "database" ? <Badge label="Database" tint /> : undefined}
		/>
	)
}

export function FromTemplateSheet() {
	const params = useLocalSearchParams<{ templateId?: string | string[] }>()
	const { colors } = useMobileColors()
	const [query, setQuery] = useState("")
	const [picked, setPicked] = useState<Step | null>(null)
	const { sections, vault } = useTemplateSections(query)
	const templates = useTemplateStore((state) => state.templates)
	const teamDatabases = useTeamDatabaseTemplates()
	const requestedId = readParam(params.templateId)

	const requestedEntry = useMemo(
		() =>
			requestedId && vault
				? resolveMarketplaceEntry(requestedId, templates, vault, teamDatabases)
				: null,
		[requestedId, teamDatabases, templates, vault],
	)

	const step: Step =
		picked ??
		(requestedEntry
			? { entry: requestedEntry, initialTitle: "", kind: "preview" }
			: { kind: "list" })

	if (step.kind === "preview" && vault) {
		return (
			<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
				<TemplatePreviewStep
					entry={step.entry}
					initialTitle={step.initialTitle}
					key={step.entry.key}
					onBack={() => setPicked({ kind: "list" })}
					vault={vault}
				/>
			</View>
		)
	}

	const trimmedQuery = query.trim()
	const noMatch = Boolean(trimmedQuery) && sections.length === 0

	return (
		<View style={[styles.root, { backgroundColor: colors.groupedBackground }]}>
			<TemplateSheetHeader
				leading={{ Icon: X, iosText: true, label: "Cancel", onPress: dismissSheet }}
				title="New from template"
				trailing={{ Icon: SlidersHorizontal, label: "Manage templates", onPress: manageTemplates }}
			/>
			<SearchField
				accessibilityLabel="Find a template"
				onChangeText={setQuery}
				onClear={() => setQuery("")}
				placeholder="New note from template…"
				value={query}
			/>
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardDismissMode="on-drag"
				keyboardShouldPersistTaps="handled"
			>
				{sections.map((section) => (
					<View key={section.key}>
						<TemplateGroupHeader team={section.teamGroup} title={section.title} />
						<GroupedList>
							{section.entries.map((entry) => (
								<TemplateRow
									entry={entry}
									key={entry.key}
									onPress={() => setPicked({ entry, initialTitle: "", kind: "preview" })}
								/>
							))}
						</GroupedList>
					</View>
				))}
				{noMatch ? (
					<View style={styles.block}>
						<GroupedList>
							<GroupedRow
								leading={<Plus color={colors.tint} size={IS_IOS ? 20 : 24} strokeWidth={2.2} />}
								onPress={() =>
									setPicked({
										entry: BLANK_TEMPLATE_ENTRY,
										initialTitle: trimmedQuery,
										kind: "preview",
									})
								}
								tint
								title={`Blank note “${trimmedQuery}”`}
							/>
						</GroupedList>
					</View>
				) : null}
				<View style={styles.marketplace}>
					<GroupedList>
						<GroupedRow
							chevron={IS_IOS}
							leading={<Store color={colors.tint} size={IS_IOS ? 22 : 24} strokeWidth={2} />}
							onPress={browseMarketplace}
							tint
							title="Browse marketplace"
						/>
					</GroupedList>
				</View>
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	block: {
		marginTop: 12,
	},
	content: {
		paddingBottom: 40,
	},
	marketplace: {
		marginTop: 18,
	},
	root: {
		flex: 1,
	},
})
