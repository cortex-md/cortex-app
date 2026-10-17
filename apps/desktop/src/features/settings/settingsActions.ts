import { useEditorStore, useSyncStore } from "@cortex/core"
import type { VaultRegistryEntry } from "@cortex/platform"
import { usePluginStore } from "@cortex/plugin-host-core"
import { noteHistoryModal } from "@/utils/modals"
import { pluginHost } from "../../bootstrap/pluginHost"
import { importFilesFromDialog } from "../import-export/importExportActions"
import { importObsidianVaultFromDialog } from "../import-export/obsidianImport"
import type { MarketplaceViewTab } from "../marketplace/marketplaceWorkspaceView"
import {
	type OpenMarketplaceViewOptions,
	openMarketplaceView,
} from "../marketplace/openMarketplaceView"
import { enablePluginWithConsent } from "../plugins/communityPluginsAccess"
import { openCommunityPluginsFolder } from "../plugins/communityPluginsFolder"
import { deletedNotesModal, syncLogsModal } from "../sync/syncDialogStores"
import { openNewTemplate, openTemplatesView } from "../templates/templateActions"
import { type AddVaultTarget, openAddVault, openRecentVault } from "../vault/vaultActions"
import { closeSettings } from "./settingsModal"

function inMainWindow(open: () => void): void {
	closeSettings()
	open()
}

const settingsActions = {
	openMarketplace: ({
		tab,
		options,
	}: {
		tab: MarketplaceViewTab
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
	openAddVault: (target: AddVaultTarget) => inMainWindow(() => openAddVault(target)),
	openVaultHere: (entry: VaultRegistryEntry) =>
		inMainWindow(() => void openRecentVault(entry, "current-window")),
	openTemplates: () => inMainWindow(() => void openTemplatesView()),
	openNewTemplate: () => inMainWindow(() => openNewTemplate({ start: "blank" })),
	openSyncLogs: () => inMainWindow(() => syncLogsModal.open(true)),
	openDeletedNotes: () => inMainWindow(() => deletedNotesModal.open(true)),
	openNoteHistory: () => {
		const filePath = useEditorStore.getState().activeFilePath
		if (filePath) inMainWindow(() => noteHistoryModal.open({ filePath }))
	},
}

type SettingsActions = typeof settingsActions

type ActionPayload<K extends keyof SettingsActions> = Parameters<SettingsActions[K]>[0]

export function runSettingsAction<K extends keyof SettingsActions>(
	name: K,
	...payload: ActionPayload<K> extends undefined ? [] : [ActionPayload<K>]
): void {
	const action = settingsActions[name] as (input?: unknown) => unknown
	void Promise.resolve(action(payload[0])).catch((error: unknown) =>
		console.error("[settings] action failed:", name, error),
	)
}
