import { useUIStore, useVaultStore } from "@cortex/core"
import { getPluginInstance } from "@cortex/plugin-host-core"
import { PluginSettingsRenderer, usePluginStore } from "@cortex/plugin-host-web"
import { useSettingsStore } from "@cortex/settings"
import type { FolderPickerOption } from "@cortex/ui"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
	LucideIcon,
	NativeSelect,
	NativeSelectOptGroup,
	NativeSelectOption,
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
} from "@cortex/ui"
import {
	Blocks,
	Keyboard,
	LayoutTemplate,
	PackageOpen,
	Palette,
	RefreshCw,
	Server,
	Settings,
	SlidersHorizontal,
	Type,
	Users,
} from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { reportAppError } from "../../utils/reportAppError"
import {
	type OpenMarketplaceHandler,
	openMarketplaceView,
} from "../marketplace/openMarketplaceView"
import { TemplatesSection } from "../templates/TemplatesSettings"
import { AppearanceSection } from "./AppearanceSettings"
import { EditorSection } from "./EditorSettings"
import { GeneralSection } from "./GeneralSettings"
import { HotkeysSection } from "./HotkeysSettings"
import { ImportExportSection } from "./ImportExportSettings"
import { PluginsSection } from "./PluginsSettings"
import { SettingsPage, SettingsPageHeader, SettingsSection } from "./SettingsPrimitives"
import { SyncSection } from "./SyncSettings"

interface SettingsSectionItem {
	id: string
	navigationLabel: string
	title: string
	description: string
	icon: typeof Settings
}

interface SettingsSectionGroup {
	label: string
	sections: SettingsSectionItem[]
}

const appSections: SettingsSectionItem[] = [
	{
		id: "general",
		navigationLabel: "General",
		title: "General",
		description: "Startup behavior and recently opened vaults.",
		icon: Settings,
	},
	{
		id: "appearance",
		navigationLabel: "Appearance",
		title: "Appearance",
		description: "Theme, accent color, and interface typography.",
		icon: Palette,
	},
	{
		id: "editor",
		navigationLabel: "Editor",
		title: "Editor",
		description: "Editing behavior, indentation, and attachment storage.",
		icon: Type,
	},
	{
		id: "hotkeys",
		navigationLabel: "Hotkeys",
		title: "Keyboard shortcuts",
		description: "Search, record, and reset command bindings for this vault.",
		icon: Keyboard,
	},
	{
		id: "templates",
		navigationLabel: "Templates",
		title: "Templates",
		description: "Create reusable note structures for this vault.",
		icon: LayoutTemplate,
	},
	{
		id: "import-export",
		navigationLabel: "Import & Export",
		title: "Import & Export",
		description: "Move notes between Cortex and external document formats.",
		icon: PackageOpen,
	},
]

const syncSections: SettingsSectionItem[] = [
	{
		id: "sync",
		navigationLabel: "Overview",
		title: "Sync",
		description: "Connection status and the remote vault linked to this workspace.",
		icon: RefreshCw,
	},
	{
		id: "sync-preferences",
		navigationLabel: "Preferences",
		title: "Sync preferences",
		description: "Choose which content and app state are synchronized.",
		icon: SlidersHorizontal,
	},
	{
		id: "sync-members",
		navigationLabel: "Members",
		title: "Sync members",
		description: "Manage access to the linked remote vault.",
		icon: Users,
	},
	{
		id: "sync-self-host",
		navigationLabel: "Self-hosted",
		title: "Self-hosted sync",
		description: "Configure the server and environment used by this vault.",
		icon: Server,
	},
]

const extensionSections: SettingsSectionItem[] = [
	{
		id: "plugins",
		navigationLabel: "Plugins",
		title: "Plugins",
		description: "Manage built-in and community extensions for this vault.",
		icon: Blocks,
	},
]

const settingsSectionGroups: SettingsSectionGroup[] = [
	{ label: "Cortex", sections: appSections },
	{ label: "Sync", sections: syncSections },
	{ label: "Extensions", sections: extensionSections },
]

const settingsSections = settingsSectionGroups.flatMap((group) => group.sections)

interface SettingsModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

interface SettingsContentProps {
	initialSection?: string | null
	onOpenMarketplace?: OpenMarketplaceHandler
	fullHeight?: boolean
}

interface SettingsSectionSelection {
	requestedSection: string | null
	sectionId: string
}

export function SettingsContent({
	initialSection = null,
	onOpenMarketplace = openMarketplaceView,
	fullHeight = false,
}: SettingsContentProps) {
	const storeSettingsInitialSection = useUIStore((s) => s.settingsInitialSection)
	const [sectionSelection, setSectionSelection] = useState<SettingsSectionSelection | null>(null)
	const { settings, updateSetting } = useSettingsStore()
	const pluginSettingsTabs = usePluginStore((s) => s.settingsTabs)
	const pluginSettingsSchemas = usePluginStore((s) => s.settingsSchemas)

	const [pluginSettingsOverrides, setPluginSettingsOverrides] = useState<
		Record<string, Record<string, unknown>>
	>({})

	const files = useVaultStore((s) => s.files)
	const vault = useVaultStore((s) => s.vault)

	const vaultFolders: FolderPickerOption[] = useMemo(() => {
		if (!vault?.path) return []
		return files.flatMap((f) => {
			if (!f.isDir || f.name.startsWith(".")) return []
			const relative = f.path.replace(`${vault.path}/`, "")
			return [{ value: relative, label: `${relative}/`, isDir: true }]
		})
	}, [files, vault?.path])

	const requestedSection = initialSection ?? storeSettingsInitialSection
	const requestedSectionExists =
		!requestedSection ||
		settingsSections.some((section) => section.id === requestedSection) ||
		pluginSettingsTabs.some(
			(tab) => tab.registrationKey === requestedSection || tab.id === requestedSection,
		)
	const activeSectionId =
		sectionSelection?.requestedSection === requestedSection
			? sectionSelection.sectionId
			: requestedSectionExists
				? (requestedSection ?? "general")
				: "general"

	const selectSection = useCallback(
		(sectionId: string) => setSectionSelection({ requestedSection, sectionId }),
		[requestedSection],
	)

	const coreSection = settingsSections.find((s) => s.id === activeSectionId)
	const pluginTab =
		pluginSettingsTabs.find((tab) => tab.registrationKey === activeSectionId) ??
		pluginSettingsTabs.find((tab) => tab.id === activeSectionId)
	const activeNavigationSectionId = pluginTab?.registrationKey ?? activeSectionId
	const activeTitle = coreSection?.title ?? pluginTab?.label ?? "Settings"
	const activeDescription =
		coreSection?.description ?? "Configure this plugin for the current vault."
	const pluginSettingsValues = useMemo(() => {
		if (!pluginTab) return {}
		const instance = getPluginInstance(pluginTab.pluginId)
		const storedValues = instance?.api.settings.getAll() ?? {}
		return { ...storedValues, ...(pluginSettingsOverrides[pluginTab.pluginId] ?? {}) }
	}, [pluginSettingsOverrides, pluginTab])

	const handlePluginSettingUpdate = useCallback((pluginId: string, key: string, value: unknown) => {
		const instance = getPluginInstance(pluginId)
		if (!instance) return
		setPluginSettingsOverrides((prev) => ({
			...prev,
			[pluginId]: { ...(prev[pluginId] ?? {}), [key]: value },
		}))
		void instance.api.settings.set(key, value).catch((error: unknown) =>
			reportAppError({
				operation: "update-plugin-setting",
				source: "settings",
				cause: error,
				userMessage: "The plugin setting could not be saved.",
				context: { pluginId, key },
			}),
		)
	}, [])

	return (
		<SidebarProvider className="settings-content h-full min-h-0 items-start overflow-hidden">
			<Sidebar collapsible="none" className="settings-sidebar hidden h-full min-h-0 md:flex">
				<SidebarContent>
					{settingsSectionGroups.map((group) => (
						<SidebarGroup key={group.label}>
							<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{group.sections.map((item) => (
										<SidebarMenuItem key={item.id}>
											<SidebarMenuButton
												onClick={() => selectSection(item.id)}
												isActive={activeSectionId === item.id}
											>
												<item.icon />
												<span>{item.navigationLabel}</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					))}
					{pluginSettingsTabs.length > 0 && (
						<SidebarGroup>
							<SidebarGroupLabel>Plugin settings</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{pluginSettingsTabs.map((tab) => (
										<SidebarMenuItem key={tab.registrationKey}>
											<SidebarMenuButton
												onClick={() => selectSection(tab.registrationKey)}
												isActive={activeNavigationSectionId === tab.registrationKey}
											>
												<LucideIcon name={tab.icon} size={16} />
												<span>{tab.label}</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					)}
				</SidebarContent>
			</Sidebar>
			<main
				className={`settings-main flex min-h-0 flex-1 flex-col overflow-hidden ${
					fullHeight ? "h-full" : "h-full max-h-full"
				}`}
			>
				<div className="shrink-0 border-b border-border p-4 md:hidden [&>[data-slot=native-select-wrapper]]:w-full">
					<NativeSelect
						aria-label="Settings section"
						value={activeNavigationSectionId}
						onChange={(event) => selectSection(event.target.value)}
						className="w-full"
					>
						{settingsSectionGroups.map((group) => (
							<NativeSelectOptGroup key={group.label} label={group.label}>
								{group.sections.map((item) => (
									<NativeSelectOption key={item.id} value={item.id}>
										{item.navigationLabel}
									</NativeSelectOption>
								))}
							</NativeSelectOptGroup>
						))}
						{pluginSettingsTabs.length > 0 && (
							<NativeSelectOptGroup label="Plugin settings">
								{pluginSettingsTabs.map((tab) => (
									<NativeSelectOption key={tab.registrationKey} value={tab.registrationKey}>
										{tab.label}
									</NativeSelectOption>
								))}
							</NativeSelectOptGroup>
						)}
					</NativeSelect>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto">
					<div className="mx-auto flex w-full max-w-[860px] flex-col gap-7 px-5 py-7 md:px-8 md:py-8">
						<SettingsPageHeader title={activeTitle} description={activeDescription} />
						{activeSectionId === "general" && (
							<GeneralSection settings={settings.general} onUpdate={updateSetting} />
						)}
						{activeSectionId === "appearance" && (
							<AppearanceSection
								settings={settings.appearance}
								onUpdate={updateSetting}
								onBrowseMarketplace={onOpenMarketplace}
							/>
						)}
						{activeSectionId === "editor" && (
							<EditorSection
								settings={settings.editor}
								onUpdate={updateSetting}
								vaultFolders={vaultFolders}
							/>
						)}
						{activeSectionId === "hotkeys" && <HotkeysSection />}
						{activeSectionId === "templates" && <TemplatesSection />}
						{activeSectionId === "import-export" && <ImportExportSection />}
						{activeSectionId === "sync" && <SyncSection view="overview" />}
						{activeSectionId === "sync-preferences" && <SyncSection view="preferences" />}
						{activeSectionId === "sync-members" && <SyncSection view="members" />}
						{activeSectionId === "sync-self-host" && <SyncSection view="self-host" />}
						{activeSectionId === "plugins" && (
							<PluginsSection onBrowseMarketplace={onOpenMarketplace} />
						)}
						{pluginTab && (
							<SettingsPage>
								<SettingsSection
									title={pluginTab.label}
									description="Settings declared by this plugin for the current vault."
								>
									<PluginSettingsRenderer
										pluginId={pluginTab.pluginId}
										settings={pluginSettingsSchemas[pluginTab.pluginId] ?? pluginTab.settings}
										values={pluginSettingsValues}
										onUpdate={(key, value) =>
											handlePluginSettingUpdate(pluginTab.pluginId, key, value)
										}
									/>
								</SettingsSection>
							</SettingsPage>
						)}
					</div>
				</div>
			</main>
		</SidebarProvider>
	)
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
	const settingsInitialSection = useUIStore((s) => s.settingsInitialSection)
	const handleOpenMarketplace = useCallback<OpenMarketplaceHandler>(
		(tab, options) => {
			onOpenChange(false)
			if (options) {
				openMarketplaceView(tab, options)
				return
			}
			openMarketplaceView(tab)
		},
		[onOpenChange],
	)

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="settings-modal-dialog-content flex gap-0 overflow-hidden p-0">
				<DialogTitle className="sr-only">Settings</DialogTitle>
				<DialogDescription className="sr-only">Customize your settings here.</DialogDescription>
				<SettingsContent
					initialSection={settingsInitialSection}
					onOpenMarketplace={handleOpenMarketplace}
				/>
			</DialogContent>
		</Dialog>
	)
}
