import { getPlatform } from "@cortex/platform"
import { pluginHost } from "../../bootstrap/pluginHost"

export async function openCommunityPluginsFolder(): Promise<void> {
	const dir = pluginHost.getCommunityPluginsDir()
	if (!dir) return
	const platform = getPlatform()
	try {
		await platform.fs.createDir(dir)
	} catch {}
	try {
		await platform.dialog.revealFolder(dir)
	} catch {
		await platform.dialog.showAlert(
			"Plugins Folder",
			`Community plugins directory: ${dir}\n\nCreate this folder to install community plugins.`,
		)
	}
}
