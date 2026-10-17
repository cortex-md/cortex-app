import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import { dirname } from "node:path"
import { getVaultFilePath, normalizePath, VAULT_FILES } from "@cortex/platform/utils"
import {
	readOrCreateVaultFile,
	renameVaultFile,
	serializeVaultFile,
	type VaultFile,
	type VaultTextIo,
} from "@cortex/platform/vault"
import writeFileAtomic from "write-file-atomic"

const vaultTextIo: VaultTextIo = {
	readText: async (path) => await fs.readFile(path, "utf8"),
	writeText: async (path, text) => {
		await fs.mkdir(dirname(path), { recursive: true })
		await writeFileAtomic(path, text, "utf8")
	},
	isNotFound: (error) => (error as NodeJS.ErrnoException).code === "ENOENT",
	createId: randomUUID,
}

const vaultFiles = new Map<string, VaultFile>()

export async function readVaultFile(vaultPath: string): Promise<VaultFile> {
	const key = normalizePath(vaultPath)
	const cached = vaultFiles.get(key)
	if (cached) return cached
	const file = await readOrCreateVaultFile(vaultPath, vaultTextIo)
	vaultFiles.set(key, file)
	return file
}

export async function writeVaultFileName(vaultPath: string, name: string): Promise<void> {
	const file = await readVaultFile(vaultPath)
	const next = renameVaultFile(file, name)
	if (!next) return
	await vaultTextIo.writeText(
		getVaultFilePath(vaultPath, VAULT_FILES.vault),
		serializeVaultFile(next),
	)
	vaultFiles.set(normalizePath(vaultPath), next)
}
