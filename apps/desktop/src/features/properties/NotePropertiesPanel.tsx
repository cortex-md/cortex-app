import {
	getHiddenPropertyDefinitions,
	getVisiblePropertyDefinitions,
	type RawNoteProjection,
	TAGS_PROPERTY_DEFINITION,
} from "@cortex/properties"
import { Button } from "@cortex/ui"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"
import { memo, useCallback, useMemo, useState } from "react"
import { AddPropertyPopover } from "./AddPropertyPopover"
import { PropertyRow } from "./PropertyRow"
import { useNotePropertiesPanel } from "./useNotePropertiesPanel"

interface NotePropertiesPanelProps {
	filePath: string
	projection?: RawNoteProjection
	readOnly?: boolean
}

function NotePropertiesPanelView({ filePath, projection, readOnly }: NotePropertiesPanelProps) {
	const panel = useNotePropertiesPanel(filePath, { projection })
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
	const visibleDefinitions = useMemo(
		() =>
			getVisiblePropertyDefinitions({
				properties: panel.schema.properties,
				persistedMeta: panel.persistedMeta,
				resolvedMeta: panel.meta,
				revealedDefinitionIds,
			}),
		[panel.meta, panel.persistedMeta, panel.schema.properties, revealedDefinitionIds],
	)
	const tagsPropertyVisible = visibleDefinitions.some((definition) => definition.key === "tags")
	const hiddenDefinitions = useMemo(
		() => getHiddenPropertyDefinitions(panel.schema.properties, visibleDefinitions),
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
				<div
					className="note-properties-content"
					aria-disabled={Boolean(panel.frontmatterError)}
					data-read-only={readOnly || undefined}
				>
					{visibleDefinitions.length > 0 ? (
						<div className="note-properties-card">
							{visibleDefinitions.map((definition) => (
								<PropertyRow
									key={definition.id}
									definition={definition}
									filePath={filePath}
									value={panel.meta[definition.key]}
									schema={panel.schema}
									authorConfig={panel.authorConfig}
									definitionConfigurable={definition.id !== TAGS_PROPERTY_DEFINITION.id}
									onSetValue={panel.setValue}
									onRemoveValue={panel.removeValue}
									onUpdateDefinition={panel.updateDefinition}
									onDeleteDefinition={panel.deleteDefinition}
									onDuplicateDefinition={panel.duplicateDefinition}
								/>
							))}
						</div>
					) : (
						!panel.frontmatterError && (
							<p className="note-properties-empty">
								No properties yet. Use "Add property" to start tracking metadata for this note.
							</p>
						)
					)}
					{!readOnly && (
						<AddPropertyPopover
							vaultPath={panel.vaultPath}
							schema={panel.schema}
							observedProperties={panel.observedProperties}
							hiddenProperties={hiddenDefinitions}
							tagsPropertyVisible={tagsPropertyVisible}
							onRegister={panel.registerProperty}
							onReveal={(definition) => revealDefinition(definition.id)}
							onRevealTags={() => revealDefinition(TAGS_PROPERTY_DEFINITION.id)}
						/>
					)}
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

export const NotePropertiesPanel = memo(NotePropertiesPanelView)
