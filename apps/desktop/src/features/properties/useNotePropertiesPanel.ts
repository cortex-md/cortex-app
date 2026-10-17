import { getErrorMessage, noteCache, useVaultStore } from "@cortex/core"
import {
	createEmptyNotePropertiesSnapshot,
	getNotePropertiesExpanded,
	type NotePropertiesPanelInput,
	type NotePropertiesSnapshot,
	onVaultSchemaChange,
	type PropertyDefinition,
	projectRawNote,
	type RawNoteProjection,
	refreshNotePropertiesSnapshot,
	removeProperty,
	schemaWithDuplicatedProperty,
	schemaWithoutProperty,
	schemaWithRegisteredProperty,
	schemaWithUpdatedProperty,
	setNotePropertiesExpanded,
	setProperty,
	updateVaultSchema,
	type VaultSchema,
} from "@cortex/properties"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

interface ScopedSnapshotState {
	filePath: string
	snapshot: NotePropertiesSnapshot
}

interface ScopedMessageState {
	filePath: string
	message: string
}

const createEmptySnapshot = createEmptyNotePropertiesSnapshot

function resolveSnapshot(
	state: ScopedSnapshotState | null,
	filePath: string,
): NotePropertiesSnapshot {
	if (state?.filePath === filePath) return state.snapshot
	return createEmptySnapshot(state?.snapshot.schema)
}

function resolveMessage(state: ScopedMessageState | null, filePath: string): string | null {
	return state?.filePath === filePath ? state.message : null
}

export function useNotePropertiesPanel(filePath: string, input: NotePropertiesPanelInput = {}) {
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const [snapshotState, setSnapshotState] = useState<ScopedSnapshotState | null>(null)
	const [expanded, setExpanded] = useState(true)
	const [errorState, setErrorState] = useState<ScopedMessageState | null>(null)
	const [frontmatterErrorState, setFrontmatterErrorState] = useState<ScopedMessageState | null>(
		null,
	)
	const refreshGeneration = useRef(0)
	const inputRef = useRef(input)
	inputRef.current = input
	const snapshot = useMemo(
		() => resolveSnapshot(snapshotState, filePath),
		[filePath, snapshotState],
	)
	const error = resolveMessage(errorState, filePath)
	const frontmatterError = resolveMessage(frontmatterErrorState, filePath)
	const invalidateRefresh = useCallback(() => {
		refreshGeneration.current++
	}, [])

	const refreshSnapshot = useCallback(
		async (nextInput: NotePropertiesPanelInput = inputRef.current) => {
			if (!vaultPath) return
			invalidateRefresh()
			const generation = refreshGeneration.current
			const isCurrentRefresh = () => generation === refreshGeneration.current
			const applySnapshot = (
				nextSnapshot: NotePropertiesSnapshot,
				nextProjection: RawNoteProjection | undefined,
			) => {
				if (!isCurrentRefresh()) return
				setSnapshotState({ filePath, snapshot: nextSnapshot })
				setFrontmatterErrorState(
					nextProjection?.frontmatterError
						? { filePath, message: nextProjection.frontmatterError }
						: null,
				)
				setErrorState(null)
			}
			const applySchemaFallback = (schema: VaultSchema) => {
				if (!isCurrentRefresh()) return
				setSnapshotState({ filePath, snapshot: createEmptySnapshot(schema) })
			}
			const applyFrontmatterError = (message: string) => {
				if (!isCurrentRefresh()) return
				setFrontmatterErrorState({ filePath, message })
			}
			await refreshNotePropertiesSnapshot(filePath, vaultPath, nextInput, {
				applySnapshot,
				applySchemaFallback,
				applyFrontmatterError,
			})
		},
		[filePath, invalidateRefresh, vaultPath],
	)

	useEffect(() => {
		if (!vaultPath) return
		let cancelled = false
		void getNotePropertiesExpanded(vaultPath, filePath).then((nextExpanded) => {
			if (!cancelled) setExpanded(nextExpanded)
		})
		return () => {
			cancelled = true
		}
	}, [filePath, vaultPath])

	useEffect(() => {
		void refreshSnapshot()
		const unsubscribeContent = noteCache.onContentChange(filePath, (_changedPath, newContent) => {
			void refreshSnapshot({ projection: projectRawNote(newContent), rawContent: newContent })
		})
		const unsubscribeSchema = vaultPath
			? onVaultSchemaChange(vaultPath, () => {
					void refreshSnapshot()
				})
			: () => {}
		return () => {
			invalidateRefresh()
			unsubscribeContent()
			unsubscribeSchema()
		}
	}, [filePath, invalidateRefresh, refreshSnapshot, vaultPath])

	const commitSchema = useCallback(
		async (nextSchema: VaultSchema) => {
			if (!vaultPath) return
			try {
				await updateVaultSchema(vaultPath, nextSchema)
				setSnapshotState((current) => ({
					filePath,
					snapshot: {
						...(current?.filePath === filePath
							? current.snapshot
							: createEmptySnapshot(current?.snapshot.schema)),
						schema: nextSchema,
					},
				}))
				setErrorState(null)
			} catch (schemaError) {
				setErrorState({ filePath, message: getErrorMessage(schemaError) })
				throw schemaError
			}
		},
		[filePath, vaultPath],
	)

	const registerProperty = useCallback(
		async (definition: PropertyDefinition) => {
			await commitSchema(schemaWithRegisteredProperty(snapshot.schema, definition))
		},
		[commitSchema, snapshot.schema],
	)

	const updateDefinition = useCallback(
		async (definition: PropertyDefinition) => {
			await commitSchema(schemaWithUpdatedProperty(snapshot.schema, definition))
		},
		[commitSchema, snapshot.schema],
	)

	const deleteDefinition = useCallback(
		async (definition: PropertyDefinition) => {
			await commitSchema(schemaWithoutProperty(snapshot.schema, definition))
		},
		[commitSchema, snapshot.schema],
	)

	const duplicateDefinition = useCallback(
		async (definition: PropertyDefinition) => {
			await commitSchema(schemaWithDuplicatedProperty(snapshot.schema, definition))
		},
		[commitSchema, snapshot.schema],
	)

	const setValue = useCallback(
		async (definition: PropertyDefinition, value: unknown) => {
			if (frontmatterError) return
			try {
				await setProperty(filePath, definition.key, value)
				setErrorState(null)
			} catch (propertyError) {
				setErrorState({ filePath, message: getErrorMessage(propertyError) })
				throw propertyError
			}
		},
		[filePath, frontmatterError],
	)

	const removeValue = useCallback(
		async (definition: PropertyDefinition) => {
			if (frontmatterError) return
			await removeProperty(filePath, definition.key)
		},
		[filePath, frontmatterError],
	)

	const toggleExpanded = useCallback(() => {
		if (!vaultPath) return
		const nextExpanded = !expanded
		setExpanded(nextExpanded)
		void setNotePropertiesExpanded(vaultPath, filePath, nextExpanded)
	}, [expanded, filePath, vaultPath])

	return {
		authorConfig: snapshot.authorConfig,
		deleteDefinition,
		duplicateDefinition,
		error,
		expanded,
		frontmatterError,
		meta: snapshot.resolvedMeta,
		observedProperties: snapshot.observedDefinitions,
		persistedMeta: snapshot.persistedMeta,
		registerProperty,
		removeValue,
		schema: snapshot.schema,
		setValue,
		toggleExpanded,
		updateDefinition,
		vaultPath,
	}
}
