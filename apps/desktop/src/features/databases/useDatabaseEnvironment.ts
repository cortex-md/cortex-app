import { getDatabaseQueryContext, useVaultStore } from "@cortex/core"
import {
	getPropertiesRuntime,
	getVaultSchema,
	type PropertyDefinition,
	type ResolvedAuthorConfig,
	resolveAuthorConfig,
	updateVaultSchema,
	type VaultSchema,
} from "@cortex/properties"
import type { DatabaseQueryContext } from "@cortex/properties/database"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocalToday } from "@/hooks/useMinuteNow"
import { setVaultSchemaSnapshot, useVaultSchemaSnapshot } from "./useVaultSchemaSnapshot"

export interface DatabaseEnvironment {
	schema: VaultSchema
	authorConfig: ResolvedAuthorConfig
	queryContext: DatabaseQueryContext
	updateDefinition: (definition: PropertyDefinition) => Promise<void>
}

const TEXT_AUTHOR: ResolvedAuthorConfig = { variant: "text" }

export function useDatabaseEnvironment(): DatabaseEnvironment {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const schema = useVaultSchemaSnapshot()
	const [authorConfig, setAuthorConfig] = useState<ResolvedAuthorConfig>(TEXT_AUTHOR)
	const [currentUserId, setCurrentUserId] = useState<string | null>(null)
	const today = useLocalToday()
	const queryContext = useMemo<DatabaseQueryContext>(
		() => ({ currentUserId, today }),
		[currentUserId, today],
	)

	useEffect(() => {
		if (!vaultPath) return
		let cancelled = false
		void Promise.all([
			getPropertiesRuntime().identity.getAuthorContext(vaultPath),
			getDatabaseQueryContext(),
		]).then(([authorContext, context]) => {
			if (cancelled) return
			setAuthorConfig(resolveAuthorConfig(authorContext))
			setCurrentUserId(context.currentUserId)
		})
		return () => {
			cancelled = true
		}
	}, [vaultPath])

	const updateDefinition = useCallback(
		async (definition: PropertyDefinition) => {
			if (!vaultPath) return
			const current = await getVaultSchema(vaultPath)
			const exists = current.properties.some((item) => item.id === definition.id)
			const next: VaultSchema = {
				version: 1,
				properties: exists
					? current.properties.map((item) => (item.id === definition.id ? definition : item))
					: [...current.properties, { ...definition, observed: undefined }],
			}
			await updateVaultSchema(vaultPath, next)
			setVaultSchemaSnapshot(vaultPath, next)
		},
		[vaultPath],
	)

	return { schema, authorConfig, queryContext, updateDefinition }
}
