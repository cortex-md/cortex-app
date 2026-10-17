import { validateVaultSchema } from "./definitions"
import { getPropertiesRuntime } from "./runtime"
import type { PropertiesRuntime, VaultSchema } from "./types"

const schemaCache = new Map<string, Promise<string>>()
let cachedRuntime: PropertiesRuntime | null = null

function isMissingFileError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error)
	return /not found|no such file|os error 2|directory does not exist|file does not exist|path does not exist/i.test(
		message,
	)
}

export function getVaultSchemaPath(vaultPath: string): string {
	return `${vaultPath}/.cortex/schema/properties.json`
}

async function readVaultSchema(runtime: PropertiesRuntime, vaultPath: string): Promise<string> {
	try {
		const raw = await runtime.files.readFile(getVaultSchemaPath(vaultPath))
		return JSON.stringify(validateVaultSchema(JSON.parse(raw) as VaultSchema))
	} catch (error) {
		if (isMissingFileError(error)) return JSON.stringify({ version: 1, properties: [] })
		throw error
	}
}

function getRuntimeCache(): { runtime: PropertiesRuntime; cache: Map<string, Promise<string>> } {
	const runtime = getPropertiesRuntime()
	if (runtime !== cachedRuntime) {
		schemaCache.clear()
		cachedRuntime = runtime
	}
	return { runtime, cache: schemaCache }
}

export async function getVaultSchema(vaultPath: string): Promise<VaultSchema> {
	const { runtime, cache } = getRuntimeCache()
	let pending = cache.get(vaultPath)
	if (!pending) {
		pending = readVaultSchema(runtime, vaultPath)
		cache.set(vaultPath, pending)
		pending.catch(() => {
			if (cache.get(vaultPath) === pending) cache.delete(vaultPath)
		})
	}
	return JSON.parse(await pending) as VaultSchema
}

export function primeVaultSchemaCache(vaultPath: string, schema: VaultSchema): void {
	getRuntimeCache().cache.set(vaultPath, Promise.resolve(JSON.stringify(schema)))
}

export function invalidateVaultSchemaCache(vaultPath?: string): void {
	if (vaultPath) schemaCache.delete(vaultPath)
	else schemaCache.clear()
}
