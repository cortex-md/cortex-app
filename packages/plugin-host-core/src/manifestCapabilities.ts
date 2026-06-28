import type { PluginCapability, PluginManifest } from "@cortex.md/api"
import { pluginStore } from "./pluginStore"

const validPluginCapabilities: PluginCapability[] = [
	"vault:read",
	"vault:write",
	"vault:delete",
	"vault:watch",
	"editor:read",
	"editor:write",
	"editor:extensions",
	"editor:folding",
	"markdown:extensions",
	"ui:views",
	"ui:sidebar",
	"ui:statusbar",
	"ui:contextmenu",
	"ui:modals",
	"workspace:tabs",
	"commands",
	"settings",
	"theme:read",
	"bookmarks:read",
	"bookmarks:write",
	"properties:types",
	"data",
	"notifications",
]

const validPluginCapabilitySet = new Set<string>(validPluginCapabilities)

export const pluginApiCapabilityRequirements = {
	"commands.register": ["commands"],
	"commands.execute": ["commands"],
	"settings.load": ["settings"],
	"settings.get": ["settings"],
	"settings.set": ["settings"],
	"settings.getAll": ["settings"],
	"settings.onChange": ["settings"],
	"settings.defineSchema": ["settings"],
	"vault.getVaultPath": ["vault:read"],
	"vault.readFile": ["vault:read"],
	"vault.writeFile": ["vault:write"],
	"vault.deleteFile": ["vault:delete"],
	"vault.listFiles": ["vault:read"],
	"vault.exists": ["vault:read"],
	"vault.onFileEvent": ["vault:watch"],
	"editor.registerExtension": ["editor:extensions"],
	"editor.registerFoldProvider": ["editor:folding"],
	"editor.getActiveFilePath": ["editor:read"],
	"editor.getActiveFileContent": ["editor:read"],
	"editor.insertAtCursor": ["editor:write"],
	"editor.replaceSelection": ["editor:write"],
	"markdown.registerInline": ["markdown:extensions"],
	"markdown.registerSemantic": ["markdown:extensions"],
	"markdown.registerPreprocessor": ["markdown:extensions"],
	"markdown.registerProcessor": ["markdown:extensions"],
	"markdown.registerCalloutType": ["markdown:extensions"],
	"properties.registerType": ["properties:types"],
	"ui.registerView": ["ui:views"],
	"ui.registerSidebarItem": ["ui:sidebar"],
	"ui.registerStatusBarItem": ["ui:statusbar"],
	"ui.registerContextMenuItem": ["ui:contextmenu"],
	"ui.registerSettingsTab": ["settings"],
	"ui.openModal": ["ui:modals"],
	"ui.closeModal": ["ui:modals"],
	"ui.showNotice": ["notifications"],
	"notifications.isSupported": ["notifications"],
	"notifications.getPermission": ["notifications"],
	"notifications.send": ["notifications"],
	"metadata.getFrontmatter": ["vault:read"],
	"metadata.getTags": ["vault:read"],
	"metadata.getAllTags": ["vault:read"],
	"data.read": ["data"],
	"data.write": ["data"],
	"data.delete": ["data"],
	"data.getDataPath": ["data"],
	"theme.getActiveThemeName": ["theme:read"],
	"theme.onThemeChange": ["theme:read"],
	"workspace.openFile": ["workspace:tabs"],
	"workspace.openView": ["workspace:tabs", "ui:views"],
	"workspace.openMarkdownTab": ["workspace:tabs", "ui:views"],
	"workspace.getOpenFiles": ["workspace:tabs"],
	"workspace.onActiveFileChange": ["workspace:tabs"],
	"bookmarks.list": ["bookmarks:read"],
	"bookmarks.add": ["bookmarks:write"],
	"bookmarks.remove": ["bookmarks:write"],
	"bookmarks.toggle": ["bookmarks:write"],
	"bookmarks.isBookmarked": ["bookmarks:read"],
	"bookmarks.onChange": ["bookmarks:read"],
} satisfies Record<string, readonly PluginCapability[]>

export function validatePluginManifestCapabilities(manifest: PluginManifest): void {
	for (const capability of manifest.capabilities ?? []) {
		if (!validPluginCapabilitySet.has(capability)) {
			throw new Error(`Unknown plugin capability "${capability}"`)
		}
	}
}

export function pluginHasCapability(pluginId: string, capability: PluginCapability): boolean {
	const manifest = pluginStore.getState().plugins[pluginId]?.manifest
	return manifest?.capabilities?.includes(capability) ?? false
}

export function requirePluginCapability(pluginId: string, capability: PluginCapability): void {
	if (!pluginHasCapability(pluginId, capability)) {
		throw new Error(`Plugin "${pluginId}" requires the ${capability} capability`)
	}
}
