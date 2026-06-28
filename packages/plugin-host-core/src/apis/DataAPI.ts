import { getPlatform } from "@cortex/platform"
import type { PluginAPI } from "@cortex.md/api"
import { requirePluginCapability } from "../manifestCapabilities"

function reportPluginDataError(
	operation: string,
	pluginId: string,
	filename: string,
	error: unknown,
): void {
	console.warn("[Plugin data operation failed]", {
		operation,
		pluginId,
		filename,
		error: error instanceof Error ? error.message : String(error),
	})
}

function validateFilename(filename: string): void {
	if (filename.includes("..") || filename.startsWith("/") || filename.startsWith("\\")) {
		throw new Error(`Invalid data filename: ${filename}`)
	}
}

export function createDataAPI(
	pluginId: string,
	getVaultPath: () => string | null,
): PluginAPI["data"] {
	function dataDir(): string | null {
		const vaultPath = getVaultPath()
		if (!vaultPath) return null
		return `${vaultPath}/.cortex/plugins/${pluginId}/data`
	}

	return {
		async read(filename: string): Promise<string | null> {
			requirePluginCapability(pluginId, "data")
			validateFilename(filename)
			const dir = dataDir()
			if (!dir) return null
			try {
				return await getPlatform().fs.readFile(`${dir}/${filename}`)
			} catch (error) {
				reportPluginDataError("read", pluginId, filename, error)
				return null
			}
		},

		async write(filename: string, content: string): Promise<void> {
			requirePluginCapability(pluginId, "data")
			validateFilename(filename)
			const dir = dataDir()
			if (!dir) return
			const platform = getPlatform()
			await platform.fs.createDir(dir)
			await platform.fs.writeFile(`${dir}/${filename}`, content)
		},

		async delete(filename: string): Promise<void> {
			requirePluginCapability(pluginId, "data")
			validateFilename(filename)
			const dir = dataDir()
			if (!dir) return
			try {
				await getPlatform().fs.deleteFile(`${dir}/${filename}`)
			} catch (error) {
				reportPluginDataError("delete", pluginId, filename, error)
			}
		},

		getDataPath(): string {
			requirePluginCapability(pluginId, "data")
			const dir = dataDir()
			if (!dir) return ""
			return dir
		},
	}
}
