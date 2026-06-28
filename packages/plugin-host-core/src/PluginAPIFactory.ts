import type { PluginAPI } from "@cortex.md/api"
import { createBookmarksAPI } from "./apis/BookmarksAPI"
import { createCommandsAPI } from "./apis/CommandsAPI"
import { createDataAPI } from "./apis/DataAPI"
import { createEditorAPI } from "./apis/EditorAPI"
import { createMarkdownAPI } from "./apis/MarkdownAPI"
import { createMetadataAPI } from "./apis/MetadataAPI"
import { createNotificationsAPI } from "./apis/NotificationsAPI"
import { createPropertiesAPI } from "./apis/PropertiesAPI"
import { createSettingsAPI } from "./apis/SettingsAPI"
import { createThemeAPI } from "./apis/ThemeAPI"
import { createVaultAPI } from "./apis/VaultAPI"
import { createWorkspaceAPI } from "./apis/WorkspaceAPI"
import { requirePluginCapability } from "./manifestCapabilities"
import { pluginStore } from "./pluginStore"

export function createPluginAPI(pluginId: string, getVaultPath: () => string | null): PluginAPI {
	const commands = createCommandsAPI(pluginId)
	const settings = createSettingsAPI(pluginId, getVaultPath)
	const vault = createVaultAPI(pluginId, getVaultPath)
	const data = createDataAPI(pluginId, getVaultPath)
	const editor = createEditorAPI(pluginId)
	const markdown = createMarkdownAPI(pluginId)
	const metadata = createMetadataAPI(pluginId)
	const theme = createThemeAPI(pluginId)
	const workspace = createWorkspaceAPI(pluginId)
	const bookmarks = createBookmarksAPI(pluginId)
	const notifications = createNotificationsAPI(pluginId)
	const properties = createPropertiesAPI(pluginId)

	const settingsWithSchema: PluginAPI["settings"] = {
		...settings,
		defineSchema(schema) {
			requirePluginCapability(pluginId, "settings")
			pluginStore.getState().setSettingsSchema(pluginId, schema)
		},
		load: settings.load,
	}

	return {
		commands,
		settings: settingsWithSchema,
		vault,
		data,
		editor,
		markdown,
		metadata,
		theme,
		workspace,
		bookmarks,
		notifications,
		properties,

		ui: {
			registerView(registration) {
				requirePluginCapability(pluginId, "ui:views")
				if (registration.location === "modal") {
					requirePluginCapability(pluginId, "ui:modals")
				}
				pluginStore.getState().addView(pluginId, registration)
				return {
					dispose() {
						pluginStore.getState().removeView(pluginId, registration.id)
					},
				}
			},
			registerSidebarItem(item) {
				requirePluginCapability(pluginId, "ui:sidebar")
				pluginStore.getState().addSidebarItem(pluginId, item)
				return {
					dispose() {
						pluginStore.getState().removeSidebarItem(pluginId, item.id)
					},
				}
			},
			registerStatusBarItem(item) {
				requirePluginCapability(pluginId, "ui:statusbar")
				pluginStore.getState().addStatusBarItem(pluginId, item)
				return {
					dispose() {
						pluginStore.getState().removeStatusBarItem(pluginId, item.id)
					},
				}
			},
			registerContextMenuItem(item) {
				requirePluginCapability(pluginId, "ui:contextmenu")
				pluginStore.getState().addContextMenuItem(pluginId, item)
				return {
					dispose() {
						pluginStore.getState().removeContextMenuItem(pluginId, item.id)
					},
				}
			},
			registerSettingsTab(tab) {
				requirePluginCapability(pluginId, "settings")
				pluginStore.getState().addSettingsTab(pluginId, tab)
				return {
					dispose() {
						pluginStore.getState().removeSettingsTab(pluginId, tab.id)
					},
				}
			},
			openModal(viewId, options) {
				requirePluginCapability(pluginId, "ui:modals")
				return pluginStore.getState().openModal(pluginId, viewId, options)
			},
			closeModal(instanceId) {
				requirePluginCapability(pluginId, "ui:modals")
				pluginStore.getState().closePluginModal(pluginId, instanceId)
			},
			showNotice(message, _duration) {
				requirePluginCapability(pluginId, "notifications")
				const pluginName = pluginStore.getState().plugins[pluginId]?.manifest.name ?? pluginId
				void notifications.send({ title: pluginName, body: message })
			},
		},
	}
}
