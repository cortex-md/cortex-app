import { getPlatform } from "@cortex/platform"
import { hashBytes } from "@cortex/platform/hash"
import {
	type FileFingerprint,
	getVaultFilePath,
	joinPath,
	toVaultRelativePath,
	VAULT_FILES,
} from "@cortex/platform/utils"
import type { DatabaseRow } from "@cortex/properties/database"

const CACHE_VERSION = 1
const WRITE_DELAY_MS = 2_000

interface CachedRow {
	fingerprint: FileFingerprint
	row: Omit<DatabaseRow, "path">
}

interface CacheFile {
	version: typeof CACHE_VERSION
	rows: Record<string, CachedRow>
}

export interface CachedDatabaseRow {
	fingerprint: FileFingerprint
	row: DatabaseRow
}

const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()

function cachePath(vaultPath: string, folderPath: string): string | null {
	const relativeFolder = toVaultRelativePath(folderPath, vaultPath)
	if (!relativeFolder) return null
	const name = `${hashBytes(relativeFolder).slice(0, 24)}.json`
	return getVaultFilePath(vaultPath, `${VAULT_FILES.databaseRows}/${name}`)
}

function isCacheFile(value: unknown): value is CacheFile {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as CacheFile).version === CACHE_VERSION &&
		typeof (value as CacheFile).rows === "object"
	)
}

export async function readDatabaseRowCache(
	vaultPath: string,
	folderPath: string,
): Promise<Map<string, CachedDatabaseRow>> {
	const path = cachePath(vaultPath, folderPath)
	const rows = new Map<string, CachedDatabaseRow>()
	if (!path) return rows
	try {
		const parsed = JSON.parse(await getPlatform().fs.readFile(path)) as unknown
		if (!isCacheFile(parsed)) return rows
		for (const [name, cached] of Object.entries(parsed.rows)) {
			const rowPath = joinPath(folderPath, name)
			rows.set(rowPath, { fingerprint: cached.fingerprint, row: { ...cached.row, path: rowPath } })
		}
	} catch {}
	return rows
}

export function scheduleDatabaseRowCacheWrite(
	vaultPath: string,
	folderPath: string,
	collect: () => Iterable<CachedDatabaseRow>,
): void {
	const path = cachePath(vaultPath, folderPath)
	if (!path) return
	const previous = pendingWrites.get(path)
	if (previous) clearTimeout(previous)
	pendingWrites.set(
		path,
		setTimeout(() => {
			pendingWrites.delete(path)
			const rows: Record<string, CachedRow> = {}
			for (const { fingerprint, row } of collect()) {
				const { path: rowPath, ...stored } = row
				const name = rowPath.slice(rowPath.lastIndexOf("/") + 1)
				rows[name] = { fingerprint, row: stored }
			}
			const content = JSON.stringify({ version: CACHE_VERSION, rows } satisfies CacheFile)
			void getPlatform()
				.fs.atomicWriteFile(path, content)
				.catch(() => {})
		}, WRITE_DELAY_MS),
	)
}

export function cancelDatabaseRowCacheWrites(): void {
	for (const timer of pendingWrites.values()) clearTimeout(timer)
	pendingWrites.clear()
}
