import { app, Menu, type MenuItemConstructorOptions } from "electron"
import { emitToRenderer } from "./events"
import { readVaultRegistry } from "./services/registry"

const RECENTS_SUBMENU_ID = "recents-submenu"

function buildRecentsSubmenu(): MenuItemConstructorOptions {
	const entries = readVaultRegistry()
	if (entries.length === 0) {
		return {
			id: RECENTS_SUBMENU_ID,
			label: "Recents",
			submenu: [{ label: "No Recent Vaults", enabled: false }],
		}
	}
	return {
		id: RECENTS_SUBMENU_ID,
		label: "Recents",
		submenu: entries.map((entry) => ({
			id: `recent-vault:${entry.path}`,
			label: entry.name,
			click: () => emitToRenderer("menu-recent-vault", entry.path),
		})),
	}
}

export function buildApplicationMenu(): Menu {
	const isMac = process.platform === "darwin"
	const template: MenuItemConstructorOptions[] = []

	if (isMac) {
		template.push({
			label: app.name,
			submenu: [
				{ role: "about" },
				{ type: "separator" },
				{
					id: "menu-open-settings",
					label: "Settings...",
					accelerator: "CmdOrCtrl+,",
					click: () => emitToRenderer("menu-open-settings"),
				},
				{ type: "separator" },
				{ role: "services" },
				{ type: "separator" },
				{ role: "hide" },
				{ role: "hideOthers" },
				{ role: "unhide" },
				{ type: "separator" },
				{ role: "quit" },
			],
		})
	}

	template.push({
		label: "File",
		submenu: [
			{
				id: "menu-new-note",
				label: "New Note",
				accelerator: "CmdOrCtrl+N",
				click: () => emitToRenderer("menu-new-note"),
			},
			{ type: "separator" },
			{
				id: "menu-open-vault",
				label: "Open Vault...",
				accelerator: "CmdOrCtrl+O",
				click: () => emitToRenderer("menu-open-vault"),
			},
			buildRecentsSubmenu(),
			{ type: "separator" },
			{
				id: "menu-close-vault",
				label: "Close Vault",
				click: () => emitToRenderer("menu-close-vault"),
			},
			...(!isMac
				? [
						{ type: "separator" as const },
						{
							id: "menu-open-settings",
							label: "Settings...",
							accelerator: "CmdOrCtrl+,",
							click: () => emitToRenderer("menu-open-settings"),
						},
					]
				: []),
		],
	})

	template.push({
		label: "Edit",
		submenu: [
			{ role: "undo" },
			{ role: "redo" },
			{ type: "separator" },
			{ role: "cut" },
			{ role: "copy" },
			{ role: "paste" },
			{ role: "selectAll" },
		],
	})

	template.push({
		label: "Navigate",
		submenu: [
			{
				id: "menu-command-palette",
				label: "Command Palette",
				accelerator: "CmdOrCtrl+Shift+P",
				click: () => emitToRenderer("menu-command-palette"),
			},
			{ type: "separator" },
			{
				id: "menu-search-vault",
				label: "Search in Vault",
				accelerator: "CmdOrCtrl+F",
				click: () => emitToRenderer("menu-search-vault"),
			},
		],
	})

	template.push({
		label: "View",
		submenu: [
			{
				id: "menu-toggle-sidebar",
				label: "Toggle Sidebar",
				accelerator: "CmdOrCtrl+B",
				click: () => emitToRenderer("menu-toggle-sidebar"),
			},
			{
				id: "menu-toggle-theme",
				label: "Toggle Colorscheme",
				accelerator: "CmdOrCtrl+Shift+L",
				click: () => emitToRenderer("menu-toggle-theme"),
			},
			{ type: "separator" },
			{ role: "togglefullscreen" },
		],
	})

	template.push({
		label: "Window",
		submenu: [{ role: "minimize" }, { type: "separator" }, { role: "close" }],
	})

	return Menu.buildFromTemplate(template)
}

export function setupApplicationMenu(): void {
	Menu.setApplicationMenu(buildApplicationMenu())
}

export function refreshMenuRecents(): void {
	setupApplicationMenu()
}
