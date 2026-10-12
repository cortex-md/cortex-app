import { toVaultRelativePath, useVaultStore } from "@cortex/core"
import { useSettingsStore } from "@cortex/settings"
import type { FolderPickerOption } from "@cortex/ui"
import { useMemo } from "react"
import type { OpenMarketplaceHandler } from "../marketplace/openMarketplaceView"
import { TemplatesSection } from "../templates/TemplatesSettings"
import { AppearanceSection } from "./AppearanceSettings"
import { EditorSection } from "./EditorSettings"
import { GeneralSection } from "./GeneralSettings"
import { HotkeysSection } from "./HotkeysSettings"
import { ImportExportSection } from "./ImportExportSettings"
import { NotificationsSection } from "./NotificationsSettings"
import { PluginsSection } from "./PluginsSettings"
import { SyncSection } from "./SyncSettings"

export interface CoreSettingsPageProps {
	onOpenMarketplace: OpenMarketplaceHandler
}

export function GeneralSettingsPage() {
	const settings = useSettingsStore((state) => state.settings.general)
	const updateSetting = useSettingsStore((state) => state.updateSetting)
	return <GeneralSection settings={settings} onUpdate={updateSetting} />
}

export function AppearanceSettingsPage({ onOpenMarketplace }: CoreSettingsPageProps) {
	const settings = useSettingsStore((state) => state.settings.appearance)
	const updateSetting = useSettingsStore((state) => state.updateSetting)
	return (
		<AppearanceSection
			settings={settings}
			onUpdate={updateSetting}
			onBrowseMarketplace={onOpenMarketplace}
		/>
	)
}

export function EditorSettingsPage() {
	const settings = useSettingsStore((state) => state.settings.editor)
	const updateSetting = useSettingsStore((state) => state.updateSetting)
	const files = useVaultStore((state) => state.files)
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const vaultFolders = useMemo<FolderPickerOption[]>(() => {
		if (!vaultPath) return []
		return files.flatMap((file) => {
			if (!file.isDir || file.name.startsWith(".")) return []
			const relative = toVaultRelativePath(file.path, vaultPath) ?? file.path
			return [{ value: relative, label: `${relative}/`, isDir: true }]
		})
	}, [files, vaultPath])
	return <EditorSection settings={settings} onUpdate={updateSetting} vaultFolders={vaultFolders} />
}

export function NotificationsSettingsPage() {
	const settings = useSettingsStore((state) => state.settings.tasks)
	const updateSetting = useSettingsStore((state) => state.updateSetting)
	return <NotificationsSection settings={settings} onUpdate={updateSetting} />
}

export function SyncOverviewPage() {
	return <SyncSection view="overview" />
}

export function SyncPreferencesPage() {
	return <SyncSection view="preferences" />
}

export function SyncMembersPage() {
	return <SyncSection view="members" />
}

export { SyncAccountPage } from "./sync/SyncAccount"

export function SyncSelfHostPage() {
	return <SyncSection view="self-host" />
}

export function PluginsSettingsPage({ onOpenMarketplace }: CoreSettingsPageProps) {
	return <PluginsSection onBrowseMarketplace={onOpenMarketplace} />
}

export { HotkeysSection as HotkeysSettingsPage }
export { ImportExportSection as ImportExportSettingsPage }
export { TemplatesSection as TemplatesSettingsPage }
