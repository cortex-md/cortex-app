import { getPlatform } from "@cortex/platform"

export interface LocalVaultCreation {
	path: string
	uuid: string
	name: string
}

const vaultsDirectoryName = "vaults"
const vaultIdentityFileName = "vault-id.json"
const vaultMetadataFileName = "vault-metadata.json"

function normalizeVaultName(name: string): string {
	const normalizedName = name.trim()
	return normalizedName.length > 0 ? normalizedName : "My Vault"
}

export async function createLocalVault(name: string): Promise<LocalVaultCreation> {
	const platform = getPlatform()
	const normalizedName = normalizeVaultName(name)
	const uuid = crypto.randomUUID()
	const appDataDir = await platform.storage.getAppDataDir()
	const vaultsDir = `${appDataDir}/${vaultsDirectoryName}`
	const vaultPath = `${vaultsDir}/${uuid}`
	const configDir = await platform.storage.getVaultConfigDir(vaultPath)

	await Promise.all([platform.fs.createDir(vaultPath), platform.fs.createDir(configDir)])
	await Promise.all([
		platform.fs.atomicWriteFile(
			`${configDir}/${vaultIdentityFileName}`,
			JSON.stringify({ uuid }, null, 2),
		),
		platform.fs.atomicWriteFile(
			`${configDir}/${vaultMetadataFileName}`,
			JSON.stringify(
				{
					createdAt: new Date().toISOString(),
					name: normalizedName,
					version: 1,
				},
				null,
				2,
			),
		),
	])

	return {
		name: normalizedName,
		path: vaultPath,
		uuid,
	}
}
