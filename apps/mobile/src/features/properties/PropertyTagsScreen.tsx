import { getErrorMessage, selectSortedTags, useTagsStore } from "@cortex/core"
import type { PropertyDefinition } from "@cortex/properties"
import { Stack } from "expo-router"
import { useState } from "react"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import type { SymbolName } from "@/components/ui/Symbol"
import { toast } from "@/features/feedback/useToast"
import { useRouteDefinition } from "@/features/properties/PropertiesContext"
import { PropertyTextField } from "@/features/properties/PropertyControls"
import { PropertyFooterSection } from "@/features/properties/PropertyValueScreens"
import { getPropertyTags } from "@/features/properties/propertyPresentation"
import type { NoteProperties } from "@/features/properties/useNoteProperties"
import { useEnsureVaultIndexed } from "@/features/search/vaultIndexing"

const SELECTED_ICON: SymbolName = { sf: "checkmark.circle.fill", md: "check_circle" }
const UNSELECTED_ICON: SymbolName = { sf: "circle", md: "radio_button_unchecked" }
const TAG_LIMIT = 50

interface TagChoice {
	count: number
	selected: boolean
	tag: string
}

function normalizeTag(value: string): string {
	return value.trim().replace(/^#+/, "").trim().toLocaleLowerCase()
}

async function writeTags(
	properties: NoteProperties,
	definition: PropertyDefinition,
	tags: string[],
): Promise<boolean> {
	if (definition.key !== "tags" || !properties.filePath) {
		return properties.setValue(definition, tags)
	}
	try {
		await useTagsStore.getState().setTagsForFile(properties.filePath, tags)
		return true
	} catch (error) {
		toast(getErrorMessage(error))
		return false
	}
}

function TagsForm({
	definition,
	properties,
}: {
	definition: PropertyDefinition
	properties: NoteProperties
}) {
	const indexed = useEnsureVaultIndexed()
	const tagIndex = useTagsStore((state) => state.tagIndex)
	const tagColors = useTagsStore((state) => state.tagColors)
	const persisted = getPropertyTags(properties.persistedMeta[definition.key])
	const persistedKey = persisted.join("\u0000")
	const [optimistic, setOptimistic] = useState<{ source: string; tags: string[] } | null>(null)
	const [query, setQuery] = useState("")
	const [fieldVersion, setFieldVersion] = useState(0)
	const tags = optimistic?.source === persistedKey ? optimistic.tags : persisted
	const selectedKeys = new Set(tags.map((tag) => tag.toLocaleLowerCase()))
	const normalized = normalizeTag(query)

	const choices: TagChoice[] = [
		...tags.map((tag) => ({ count: tagIndex[tag]?.length ?? 0, selected: true, tag })),
		...selectSortedTags({ tagIndex, tagColors })
			.filter((entry) => !selectedKeys.has(entry.tag.toLocaleLowerCase()))
			.map((entry) => ({ count: entry.filePaths.length, selected: false, tag: entry.tag })),
	]
	const filtered = (
		normalized
			? choices.filter((choice) => choice.tag.toLocaleLowerCase().includes(normalized))
			: choices
	).slice(0, TAG_LIMIT)
	const canCreate =
		Boolean(normalized) &&
		!selectedKeys.has(normalized) &&
		!choices.some((choice) => choice.tag.toLocaleLowerCase() === normalized)

	function commit(next: string[]) {
		setOptimistic({ source: persistedKey, tags: next })
		void writeTags(properties, definition, next).then((saved) => {
			if (!saved) setOptimistic(null)
		})
	}

	function toggle(choice: TagChoice) {
		const key = choice.tag.toLocaleLowerCase()
		commit(
			choice.selected
				? tags.filter((tag) => tag.toLocaleLowerCase() !== key)
				: [...tags, choice.tag],
		)
	}

	function create() {
		if (!canCreate) return
		commit([...tags, normalized])
		setQuery("")
		setFieldVersion((version) => version + 1)
	}

	return (
		<NativeForm>
			<FormSection>
				<PropertyTextField
					key={fieldVersion}
					keyboard="tag"
					onChangeText={setQuery}
					onSubmit={create}
					placeholder="Search or create a tag"
				/>
			</FormSection>
			<FormSection>
				{canCreate ? (
					<FormRow
						icon={{ sf: "plus", md: "add" }}
						onPress={create}
						tint
						title={`Create #${normalized}`}
					/>
				) : null}
				{filtered.map((choice) => (
					<FormRow
						icon={choice.selected ? SELECTED_ICON : UNSELECTED_ICON}
						key={choice.tag}
						onPress={() => toggle(choice)}
						title={`#${choice.tag}`}
						value={choice.count > 0 ? String(choice.count) : undefined}
					/>
				))}
				{!indexed && filtered.length === 0 ? <FormRow disabled title="Loading tags…" /> : null}
				{indexed && filtered.length === 0 && !canCreate ? (
					<FormRow disabled title="No tags yet" />
				) : null}
			</FormSection>
			<PropertyFooterSection definition={definition} properties={properties} />
		</NativeForm>
	)
}

export function PropertyTagsScreen() {
	const { definition, properties } = useRouteDefinition()
	return (
		<>
			<Stack.Screen options={{ title: definition?.name ?? "Tags" }} />
			{definition ? (
				<TagsForm definition={definition} key={definition.id} properties={properties} />
			) : (
				<NativeForm>{null}</NativeForm>
			)}
		</>
	)
}
