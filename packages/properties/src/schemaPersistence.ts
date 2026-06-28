import { validateVaultSchema } from "./definitions"
import { getPropertiesRuntime } from "./runtime"
import type { VaultSchema } from "./types"

function isMissingFileError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error)
	return /not found|no such file|os error 2/i.test(message)
}

export async function getVaultSchema(vaultPath: string): Promise<VaultSchema> {
	const runtime = getPropertiesRuntime()
	try {
		const raw = await runtime.files.readFile(`${vaultPath}/.cortex/schema/properties.json`)
		return validateVaultSchema(JSON.parse(raw) as VaultSchema)
	} catch (error) {
		if (isMissingFileError(error)) return { version: 1, properties: [] }
		throw error
	}
}
