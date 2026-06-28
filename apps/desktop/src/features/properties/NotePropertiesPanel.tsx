import {
	isEmptyPropertyValue,
	type PropertyDefinition,
	type RawNoteProjection,
} from "@cortex/properties"
import { Button } from "@cortex/ui"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { AddPropertyPopover } from "./AddPropertyPopover"
import { PropertyRow } from "./PropertyRow"
import { useNotePropertiesPanel } from "./useNotePropertiesPanel"

interface NotePropertiesPanelProps {
	filePath: string
	rawContent?: string
	projection?: RawNoteProjection
}

const tagsPropertyDefinition: PropertyDefinition = {
	id: "00000000-0000-4000-8000-000000000001",
	key: "tags",
	name: "tags",
	type: "tags",
	createdAt: "1970-01-01T00:00:00.000Z",
}

function isVisiblePropertyDefinition(
	definition: PropertyDefinition,
	persistedMeta: Record<string, unknown>,
	resolvedMeta: Record<string, unknown>,
	revealedDefinitionIds: Set<string>,
): boolean {
	const hasPersistedValue = Object.hasOwn(persistedMeta, definition.key)
	const persistedValue = persistedMeta[definition.key]
	const resolvedValue = resolvedMeta[definition.key]
	if (revealedDefinitionIds.has(definition.id)) return true
	if (definition.type === "created_time") return !isEmptyPropertyValue(resolvedValue)
	if (
		definition.type === "id" ||
		definition.type === "created_by" ||
		definition.type === "last_edited_time" ||
		definition.type === "last_edited_by"
	) {
		return hasPersistedValue && !isEmptyPropertyValue(persistedValue)
	}
	if (definition.defaultOptionId && isEmptyPropertyValue(persistedValue)) return false
	return hasPersistedValue
}

export function NotePropertiesPanel({
	filePath,
	rawContent,
	projection,
}: NotePropertiesPanelProps) {
	const panel = useNotePropertiesPanel(filePath, { rawContent, projection })
	const [revealedState, setRevealedState] = useState<{
		filePath: string
		definitionIds: Set<string>
	}>(() => ({ filePath, definitionIds: new Set() }))
	const revealedDefinitionIds = useMemo(
		() => (revealedState.filePath === filePath ? revealedState.definitionIds : new Set<string>()),
		[filePath, revealedState],
	)
	const revealDefinition = useCallback(
		(definitionId: string) => {
			setRevealedState((current) => {
				const definitionIds =
					current.filePath === filePath ? current.definitionIds : new Set<string>()
				return {
					filePath,
					definitionIds: new Set([...definitionIds, definitionId]),
				}
			})
		},
		[filePath],
	)
	const visibleDefinitions = useMemo(() => {
		const schemaDefinitions = panel.schema.properties.filter((definition) =>
			isVisiblePropertyDefinition(
				definition,
				panel.persistedMeta,
				panel.meta,
				revealedDefinitionIds,
			),
		)
		const schemaTagsDefinition = panel.schema.properties.find(
			(definition) => definition.key === "tags",
		)
		const visibleSchemaTagsDefinition = schemaDefinitions.find(
			(definition) => definition.id === schemaTagsDefinition?.id,
		)
		const hasYamlTags = Object.hasOwn(panel.persistedMeta, "tags")
		const showVirtualTags =
			!schemaTagsDefinition && (hasYamlTags || revealedDefinitionIds.has(tagsPropertyDefinition.id))
		const orderedDefinitions = visibleSchemaTagsDefinition
			? [
					visibleSchemaTagsDefinition,
					...schemaDefinitions.filter(
						(definition) => definition.id !== visibleSchemaTagsDefinition.id,
					),
				]
			: schemaDefinitions
		return showVirtualTags ? [tagsPropertyDefinition, ...orderedDefinitions] : orderedDefinitions
	}, [panel.meta, panel.persistedMeta, panel.schema.properties, revealedDefinitionIds])
	const tagsPropertyVisible = visibleDefinitions.some((definition) => definition.key === "tags")
	const hiddenDefinitions = useMemo(
		() =>
			panel.schema.properties.filter(
				(definition) =>
					!visibleDefinitions.some((visibleDefinition) => visibleDefinition.id === definition.id),
			),
		[panel.schema.properties, visibleDefinitions],
	)
	if (!panel.vaultPath) return null

	return (
		<section className="note-properties" aria-label="Note properties">
			<div className="note-properties-header">
				<Button variant="ghost" size="xs" onClick={panel.toggleExpanded}>
					{panel.expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
					Properties
				</Button>
			</div>
			{panel.expanded && (
				<div className="note-properties-content" aria-disabled={Boolean(panel.frontmatterError)}>
					{visibleDefinitions.length > 0 && (
						<div className="note-properties-card">
							{visibleDefinitions.map((definition) => (
								<PropertyRow
									key={definition.id}
									definition={definition}
									filePath={filePath}
									value={panel.meta[definition.key]}
									schema={panel.schema}
									authorConfig={panel.authorConfig}
									definitionConfigurable={definition.id !== tagsPropertyDefinition.id}
									onSetValue={panel.setValue}
									onRemoveValue={panel.removeValue}
									onUpdateDefinition={panel.updateDefinition}
									onDeleteDefinition={panel.deleteDefinition}
									onDuplicateDefinition={panel.duplicateDefinition}
								/>
							))}
						</div>
					)}
					<AddPropertyPopover
						vaultPath={panel.vaultPath}
						schema={panel.schema}
						observedProperties={panel.observedProperties}
						hiddenProperties={hiddenDefinitions}
						tagsPropertyVisible={tagsPropertyVisible}
						onRegister={panel.registerProperty}
						onReveal={(definition) => revealDefinition(definition.id)}
						onRevealTags={() => revealDefinition(tagsPropertyDefinition.id)}
					/>
					{panel.frontmatterError && (
						<output className="note-properties-error">
							Properties are read-only until the YAML frontmatter is fixed: {panel.frontmatterError}
						</output>
					)}
					{panel.error && <output className="note-properties-error">{panel.error}</output>}
				</div>
			)}
		</section>
	)
}
