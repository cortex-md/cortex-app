import { getErrorMessage, noteCache, useVaultStore } from "@cortex/core"
import {
	createEmptyNotePropertiesSnapshot,
	getPropertyValueUsage,
	loadNotePropertiesSnapshot,
	type NotePropertiesSnapshot,
	onVaultSchemaChange,
	type PropertyDefinition,
	type PropertyValueUsage,
	projectRawNote,
	removeProperty,
	schemaWithRegisteredProperty,
	schemaWithUpdatedProperty,
	setProperty,
	updateVaultSchema,
} from "@cortex/properties"
import { useEffect, useState } from "react"

import { toast } from "@/features/feedback/useToast"

interface ScopedSnapshot {
	filePath: string
	snapshot: NotePropertiesSnapshot
}

const EMPTY_SNAPSHOT = createEmptyNotePropertiesSnapshot()
const EMPTY_USAGE: PropertyValueUsage = { notes: 0, values: {} }

async function runPropertyWrite(task: () => Promise<void>): Promise<boolean> {
	try {
		await task()
		return true
	} catch (error) {
		toast(getErrorMessage(error))
		return false
	}
}

export function useNoteProperties(filePath: string | null) {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const [scoped, setScoped] = useState<ScopedSnapshot | null>(null)
	const [usage, setUsage] = useState<Record<string, PropertyValueUsage>>({})
	const [revealedKeys, setRevealedKeys] = useState<ReadonlySet<string>>(() => new Set())
	const snapshot = scoped && scoped.filePath === filePath ? scoped.snapshot : EMPTY_SNAPSHOT

	useEffect(() => {
		if (!filePath || !vaultPath) return
		const tracker = { disposed: false, latest: 0 }
		const refresh = (rawContent?: string) => {
			tracker.latest += 1
			const generation = tracker.latest
			const options = rawContent === undefined ? {} : { projection: projectRawNote(rawContent) }
			void loadNotePropertiesSnapshot(filePath, options).then(
				(next) => {
					if (!tracker.disposed && generation === tracker.latest) {
						setScoped({ filePath, snapshot: next })
					}
				},
				(error) => toast(getErrorMessage(error)),
			)
		}
		refresh()
		const unsubscribeContent = noteCache.onContentChange(filePath, (_path, content) =>
			refresh(content),
		)
		const unsubscribeSchema = onVaultSchemaChange(vaultPath, () => refresh())
		return () => {
			tracker.disposed = true
			unsubscribeContent()
			unsubscribeSchema()
		}
	}, [filePath, vaultPath])

	useEffect(() => {
		if (!vaultPath) return
		let cancelled = false
		const keys = snapshot.schema.properties.map((definition) => definition.key)
		void Promise.all(keys.map((key) => getPropertyValueUsage(vaultPath, key))).then((results) => {
			if (cancelled) return
			setUsage(Object.fromEntries(keys.map((key, index) => [key, results[index]])))
		})
		return () => {
			cancelled = true
		}
	}, [snapshot.schema, vaultPath])

	function findDefinition(key: string | undefined): PropertyDefinition | null {
		if (!key) return null
		return (
			snapshot.schema.properties.find((definition) => definition.key === key) ??
			snapshot.observedDefinitions.find((definition) => definition.key === key) ??
			null
		)
	}

	function reveal(key: string) {
		setRevealedKeys((current) => new Set(current).add(key))
	}

	async function setValue(definition: PropertyDefinition, value: unknown): Promise<boolean> {
		if (!filePath) return false
		return runPropertyWrite(() => setProperty(filePath, definition.key, value))
	}

	async function removeValue(definition: PropertyDefinition): Promise<boolean> {
		if (!filePath) return false
		return runPropertyWrite(() => removeProperty(filePath, definition.key))
	}

	async function saveDefinition(definition: PropertyDefinition): Promise<boolean> {
		if (!vaultPath) return false
		const exists = snapshot.schema.properties.some((candidate) => candidate.id === definition.id)
		const next = exists
			? schemaWithUpdatedProperty(snapshot.schema, definition)
			: schemaWithRegisteredProperty(snapshot.schema, definition)
		return runPropertyWrite(() => updateVaultSchema(vaultPath, next))
	}

	return {
		findDefinition,
		persistedMeta: snapshot.persistedMeta,
		removeValue,
		resolvedMeta: snapshot.resolvedMeta,
		reveal,
		revealedKeys,
		saveDefinition,
		schema: snapshot.schema,
		authorConfig: snapshot.authorConfig,
		setValue,
		usageFor: (key: string) => usage[key] ?? EMPTY_USAGE,
		vaultPath,
	}
}

export type NoteProperties = ReturnType<typeof useNoteProperties>
