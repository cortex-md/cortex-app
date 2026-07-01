export const DATABASE_CATALOG_FILE = ".cortex/schema/databases.json"
export const DATABASE_INDEX_FILE = ".cortex/database-index.json"

export function getDatabaseCatalogPath(vaultPath: string): string {
	return `${vaultPath}/${DATABASE_CATALOG_FILE}`
}

export function getDatabaseIndexPath(vaultPath: string): string {
	return `${vaultPath}/${DATABASE_INDEX_FILE}`
}
