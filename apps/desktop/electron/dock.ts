import { sortRecentVaults } from "@cortex/platform/vault"
import { app, Menu, type MenuItemConstructorOptions } from "electron"
import { readVaultRegistry } from "./services/registry"
import { listMainWindows, openNewWindow, openVaultWindow } from "./windows"

const MAX_RECENTS = 10

function recentVaults() {
	return sortRecentVaults(readVaultRegistry()).slice(0, MAX_RECENTS)
}

function openVaultPaths(): Set<string> {
	return new Set(listMainWindows().flatMap((entry) => (entry.vaultPath ? [entry.vaultPath] : [])))
}

function launchArgs(extra: string): string {
	const devEntry = process.defaultApp && process.argv[1] ? `"${process.argv[1]}" ` : ""
	return `${devEntry}${extra}`
}

export function setupDockMenu(): void {
	const recents = recentVaults()
	if (process.platform === "darwin") {
		const open = openVaultPaths()
		const template: MenuItemConstructorOptions[] = [
			...recents.map((entry) => ({
				label: entry.name,
				type: "checkbox" as const,
				checked: open.has(entry.path),
				click: () => openVaultWindow(entry.path),
			})),
			...(recents.length > 0 ? [{ type: "separator" as const }] : []),
			{ label: "New Window", click: () => openNewWindow() },
		]
		app.dock?.setMenu(Menu.buildFromTemplate(template))
		return
	}
	if (process.platform === "win32") {
		app.setJumpList([
			{
				type: "custom",
				name: "Recent Vaults",
				items: recents.map((entry) => ({
					type: "task" as const,
					title: entry.name,
					description: entry.path,
					program: process.execPath,
					args: launchArgs(`--open-vault="${entry.path}"`),
					iconPath: process.execPath,
					iconIndex: 0,
				})),
			},
			{
				type: "tasks",
				items: [
					{
						type: "task",
						title: "New Window",
						description: "Open a new Cortex window",
						program: process.execPath,
						args: launchArgs("--new-window"),
						iconPath: process.execPath,
						iconIndex: 0,
					},
				],
			},
		])
	}
}
