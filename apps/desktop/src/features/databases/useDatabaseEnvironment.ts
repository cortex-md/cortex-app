import { getDatabaseQueryContext, useVaultStore } from "@cortex/core"
import {
	getPropertiesRuntime,
	type PropertyDefinition,
	type ResolvedAuthorConfig,
	resolveAuthorConfig,
	upsertVaultSchemaDefinition,
	type VaultSchema,
} from "@cortex/properties"
import type { DatabaseQueryContext } from "@cortex/properties/database"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocalToday } from "@/hooks/useMinuteNow"
import { useVaultSchemaSnapshot } from "./useVaultSchemaSnapshot"

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
			await upsertVaultSchemaDefinition(vaultPath, definition)
		},
		[vaultPath],
	)

	return { schema, authorConfig, queryContext, updateDefinition }
}
