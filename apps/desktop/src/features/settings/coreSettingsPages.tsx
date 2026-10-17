import { useSettingsStore } from "@cortex/settings"
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
import { useSettingsVaultFolders } from "./useSettingsVaultFiles"
import { VaultsPage } from "./vaults/VaultsPage"

export interface CoreSettingsPageProps {
	onOpenMarketplace: OpenMarketplaceHandler
}

export function GeneralSettingsPage() {
	const settings = useSettingsStore((state) => state.settings.general)
	const updateSetting = useSettingsStore((state) => state.updateSetting)
	return <GeneralSection settings={settings} onUpdate={updateSetting} />
}

export function VaultsSettingsPage() {
	return <VaultsPage />
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
	const vaultFolders = useSettingsVaultFolders()
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

export {
	HotkeysSection as HotkeysSettingsPage,
	ImportExportSection as ImportExportSettingsPage,
	TemplatesSection as TemplatesSettingsPage,
}
