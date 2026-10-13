import { reportAppError } from "@cortex/core"
import { type AppSettings, useSettingsStore } from "@cortex/settings"

import type { SymbolName } from "@/components/ui/Symbol"
import type { SettingsPage } from "@/features/navigation/routes"

export interface SettingsLink {
	key: string
	title: string
	icon: SymbolName
	page: SettingsPage
}

export const CORTEX_SETTINGS_LINKS: SettingsLink[] = [
	{ key: "general", title: "General", icon: { sf: "gearshape", md: "tune" }, page: "general" },
	{ key: "vaults", title: "Vaults", icon: { sf: "folder", md: "folder" }, page: "vaults" },
	{
		key: "appearance",
		title: "Appearance",
		icon: { sf: "paintpalette", md: "palette" },
		page: "appearance",
	},
	{
		key: "editor",
		title: "Editor",
		icon: { sf: "square.and.pencil", md: "edit_note" },
		page: "editor",
	},
	{
		key: "hotkeys",
		title: "Keyboard shortcuts",
		icon: { sf: "keyboard", md: "keyboard" },
		page: "hotkeys",
	},
	{
		key: "templates",
		title: "Templates",
		icon: { sf: "doc.on.doc", md: "dashboard_customize" },
		page: "templates",
	},
	{
		key: "import-export",
		title: "Import & Export",
		icon: { sf: "arrow.up.arrow.down", md: "import_export" },
		page: "import-export",
	},
	{
		key: "notifications",
		title: "Notifications",
		icon: { sf: "bell", md: "notifications" },
		page: "notifications",
	},
]

export const SYNC_SETTINGS_LINKS: SettingsLink[] = [
	{
		key: "overview",
		title: "Overview",
		icon: { sf: "arrow.triangle.2.circlepath", md: "sync" },
		page: "sync",
	},
	{
		key: "prefs",
		title: "Preferences",
		icon: { sf: "slider.horizontal.3", md: "tune" },
		page: "sync/prefs",
	},
	{ key: "members", title: "Members", icon: { sf: "person.2", md: "group" }, page: "sync/members" },
	{
		key: "self-hosted",
		title: "Self-hosted",
		icon: { sf: "server.rack", md: "dns" },
		page: "sync/self-hosted",
	},
]

export const EXTENSION_SETTINGS_LINKS: SettingsLink[] = [
	{
		key: "plugins",
		title: "Plugins",
		icon: { sf: "puzzlepiece.extension", md: "extension" },
		page: "plugins",
	},
	{
		key: "marketplace",
		title: "Marketplace",
		icon: { sf: "storefront", md: "storefront" },
		page: "marketplace",
	},
]

export const ALL_SETTINGS_LINKS = [
	...CORTEX_SETTINGS_LINKS,
	...SYNC_SETTINGS_LINKS,
	...EXTENSION_SETTINGS_LINKS,
]

export function updateSetting<K extends keyof AppSettings>(
	section: K,
	key: keyof AppSettings[K],
	value: unknown,
): void {
	void useSettingsStore
		.getState()
		.updateSetting(section, key, value)
		.catch((cause: unknown) =>
			reportAppError({
				operation: "update-setting",
				source: "mobile-settings",
				cause,
				userMessage: "Unable to save this setting.",
			}),
		)
}
