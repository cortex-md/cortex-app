import { useEditorStore, useSyncStore } from "@cortex/core"
import type { MarketplaceTab } from "@cortex/marketplace"
import { getPlatform } from "@cortex/platform"
import { usePluginStore } from "@cortex/plugin-host-core"
import { pluginHost } from "../bootstrap/pluginHost"
import { importFilesFromDialog } from "../features/import-export/importExportActions"
import { importObsidianVaultFromDialog } from "../features/import-export/obsidianImport"
import {
	type OpenMarketplaceViewOptions,
	openMarketplaceView,
} from "../features/marketplace/openMarketplaceView"
import { enablePluginWithConsent } from "../features/plugins/communityPluginsAccess"
import { openCommunityPluginsFolder } from "../features/plugins/communityPluginsFolder"
import { noteHistoryModal } from "../features/sync/noteHistoryModal"
import { deletedNotesModal, syncLogsModal } from "../features/sync/syncDialogStores"

function inMainWindow(open: () => void): void {
	open()
	void getPlatform().window.focusMain()
}

export const mainWindowActions = {
	openMarketplace: ({
		tab,
		options,
	}: {
		tab: MarketplaceTab
		options?: OpenMarketplaceViewOptions
	}) => inMainWindow(() => openMarketplaceView(tab, options)),
	importFiles: () => importFilesFromDialog("settings"),
	importObsidian: () => inMainWindow(() => void importObsidianVaultFromDialog()),
	setPluginEnabled: async ({ pluginId, enabled }: { pluginId: string; enabled: boolean }) => {
		const record = usePluginStore.getState().plugins[pluginId]
		if (!record) return
		if (enabled) {
			if (!(await enablePluginWithConsent(record))) return
		} else {
			await pluginHost.disablePlugin(pluginId)
		}
		await pluginHost.saveEnabledPlugins()
	},
	setPluginSetting: ({ pluginId, key, value }: { pluginId: string; key: string; value: unknown }) =>
		pluginHost.setPluginSetting(pluginId, key, value),
	openCommunityPluginsFolder,
	restartSync: () => useSyncStore.getState().restartSync(),
	openSyncLogs: () => inMainWindow(() => syncLogsModal.open(true)),
	openDeletedNotes: () => inMainWindow(() => deletedNotesModal.open(true)),
	openNoteHistory: () => {
		const filePath = useEditorStore.getState().activeFilePath
		if (filePath) inMainWindow(() => noteHistoryModal.open({ filePath }))
	},
}

export type MainWindowActions = typeof mainWindowActions
