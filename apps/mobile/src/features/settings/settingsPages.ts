import { reportAppError } from "@cortex/core"
import { type AppSettings, useSettingsStore } from "@cortex/settings"
import {
	ArrowUpDown,
	Bell,
	Folder,
	Keyboard,
	LayoutDashboard,
	type LucideIcon,
	Palette,
	PenLine,
	Puzzle,
	RefreshCw,
	Server,
	SlidersHorizontal,
	Store,
	Users,
} from "lucide-react-native"

import type { SettingsPage } from "@/features/navigation/routes"

export interface SettingsLink {
	key: string
	title: string
	Icon: LucideIcon
	page: SettingsPage
}

export const CORTEX_SETTINGS_LINKS: SettingsLink[] = [
	{ key: "general", title: "General", Icon: SlidersHorizontal, page: "general" },
	{ key: "vaults", title: "Vaults", Icon: Folder, page: "vaults" },
	{ key: "appearance", title: "Appearance", Icon: Palette, page: "appearance" },
	{ key: "editor", title: "Editor", Icon: PenLine, page: "editor" },
	{ key: "hotkeys", title: "Keyboard shortcuts", Icon: Keyboard, page: "hotkeys" },
	{ key: "templates", title: "Templates", Icon: LayoutDashboard, page: "templates" },
	{ key: "import-export", title: "Import & Export", Icon: ArrowUpDown, page: "import-export" },
	{ key: "notifications", title: "Notifications", Icon: Bell, page: "notifications" },
]

export const SYNC_SETTINGS_LINKS: SettingsLink[] = [
	{ key: "overview", title: "Overview", Icon: RefreshCw, page: "sync" },
	{ key: "prefs", title: "Preferences", Icon: SlidersHorizontal, page: "sync/prefs" },
	{ key: "members", title: "Members", Icon: Users, page: "sync/members" },
	{ key: "self-hosted", title: "Self-hosted", Icon: Server, page: "sync/self-hosted" },
]

export const EXTENSION_SETTINGS_LINKS: SettingsLink[] = [
	{ key: "plugins", title: "Plugins", Icon: Puzzle, page: "plugins" },
	{ key: "marketplace", title: "Marketplace", Icon: Store, page: "marketplace" },
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
