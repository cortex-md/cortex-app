import { retainDatabase, useDatabaseStore } from "@cortex/core"
import { getPropertyValueList, resolvePropertyOption } from "@cortex/properties"
import { getPropertyBaseType } from "@cortex/properties/database"
import { SimpleTooltip } from "@cortex/ui"
import { useEffect } from "react"
import { useVaultSchemaSnapshot } from "./useVaultSchemaSnapshot"

export function DatabaseTreeRetainer({ folderPath }: { folderPath: string }) {
	useEffect(() => retainDatabase(folderPath), [folderPath])
	return null
}

export function useIsDatabaseFolder(folderPath: string): boolean {
	return useDatabaseStore((state) => Boolean(state.databases[folderPath]))
}

export function DatabaseRowDot({ folderPath, path }: { folderPath: string; path: string }) {
	const schema = useVaultSchemaSnapshot()
	const groupKey = useDatabaseStore((state) => state.databases[folderPath]?.config.views[0]?.group)
	const meta = useDatabaseStore((state) => state.rowsByFolder[folderPath]?.rows[path]?.meta)
	if (!meta) return <span className="file-tree-db-dot" aria-hidden="true" />
	const definition =
		schema.properties.find(
			(item) => item.key === groupKey && getPropertyBaseType(item) === "select",
		) ??
		schema.properties.find(
			(item) => getPropertyBaseType(item) === "select" && Object.hasOwn(meta, item.key),
		)
	const value = definition ? getPropertyValueList(meta[definition.key])[0] : undefined
	const option = definition && value !== undefined ? resolvePropertyOption(definition, value) : null
	return (
		<SimpleTooltip label={option ? `${definition?.name}: ${option.label}` : undefined} side="right">
			<span className="file-tree-db-dot" data-color={option?.color} aria-hidden="true" />
		</SimpleTooltip>
	)
}
