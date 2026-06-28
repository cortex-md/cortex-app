import { getPlatform } from "@cortex/platform"
import type { Disposable, PluginAPI, VaultFileEvent } from "@cortex.md/api"
import { requirePluginCapability } from "../manifestCapabilities"

function validateRelativePath(relativePath: string): void {
	if (
		relativePath.includes("..") ||
		relativePath.startsWith("/") ||
		relativePath.startsWith("\\")
	) {
		throw new Error(`Path must be relative to vault root: ${relativePath}`)
	}
}

export function createVaultAPI(
	pluginId: string,
	getVaultPath: () => string | null,
): PluginAPI["vault"] {
	const fileEventListeners = new Set<(event: VaultFileEvent) => void>()

	function resolvePath(relativePath: string): string {
		validateRelativePath(relativePath)
		const vaultPath = getVaultPath()
		if (!vaultPath) throw new Error("No vault is open")
		return `${vaultPath}/${relativePath}`
	}

	return {
		getVaultPath() {
			requirePluginCapability(pluginId, "vault:read")
			return getVaultPath()
		},

		async readFile(relativePath: string): Promise<string> {
			requirePluginCapability(pluginId, "vault:read")
			return getPlatform().fs.readFile(resolvePath(relativePath))
		},

		async writeFile(relativePath: string, content: string): Promise<void> {
			requirePluginCapability(pluginId, "vault:write")
			await getPlatform().fs.writeFile(resolvePath(relativePath), content)
		},

		async deleteFile(relativePath: string): Promise<void> {
			requirePluginCapability(pluginId, "vault:delete")
			await getPlatform().fs.deleteFile(resolvePath(relativePath))
		},

		async listFiles(dir?: string) {
			requirePluginCapability(pluginId, "vault:read")
			const fullPath = dir ? resolvePath(dir) : getVaultPath()
			if (!fullPath) throw new Error("No vault is open")
			return getPlatform().fs.listDir(fullPath)
		},

		async exists(relativePath: string): Promise<boolean> {
			requirePluginCapability(pluginId, "vault:read")
			try {
				await getPlatform().fs.readFile(resolvePath(relativePath))
				return true
			} catch {
				return false
			}
		},

		onFileEvent(callback: (event: VaultFileEvent) => void): Disposable {
			requirePluginCapability(pluginId, "vault:watch")
			fileEventListeners.add(callback)
			return {
				dispose() {
					fileEventListeners.delete(callback)
				},
			}
		},
	}
}
