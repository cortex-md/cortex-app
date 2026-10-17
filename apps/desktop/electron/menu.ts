import type { NativeMenuCommand, NativeMenuItemStates, NativeMenuState } from "@cortex/platform"
import { sortRecentVaults } from "@cortex/platform/vault"
import { app, Menu, type MenuItem, type MenuItemConstructorOptions } from "electron"
import type { MainApi } from "./contract"
import { setupDockMenu } from "./dock"
import { getInvokeSender } from "./ipc/sender"
import { readVaultRegistry } from "./services/registry"
import { toAccelerator } from "./utils/accelerator"
import {
	emitToTargetWindow,
	listMainWindows,
	openNewWindow,
	openVaultWindow,
	resolveMainWindowId,
} from "./windows"

type Requirement = "vault" | "note" | "editor"

interface CommandItemOptions {
	label?: string
	payload?: Record<string, unknown>
	requires?: Requirement
	checked?: string
	type?: "checkbox" | "radio"
	showShortcut?: boolean
}

interface MenuContext {
	state: NativeMenuState | null
	commands: Map<string, NativeMenuCommand>
	isMac: boolean
}

const REBUILD_DELAY_MS = 40
const MAX_RECENTS = 12
const EDITOR_MODES = [
	["source", "Source"],
	["live-preview", "Live Preview"],
	["reading", "Reading"],
	["side-by-side", "Side by Side"],
] as const
const EDITOR_TOGGLES = [
	["wordWrap", "Word Wrap"],
	["showLineNumbers", "Line Numbers"],
	["vimMode", "Vim Mode"],
] as const
const COLOR_SCHEMES = [
	["light", "Light"],
	["dark", "Dark"],
	["system", "System"],
] as const

interface ItemBinding {
	commandId: string
	requires?: Requirement
	checkedKey?: string
}

interface LiveItemBinding extends ItemBinding {
	item: MenuItem
}

const menuStates = new Map<number, NativeMenuState>()
const pendingBindings = new Map<string, ItemBinding>()
let liveBindings: LiveItemBinding[] = []
let builtCommandsSignature: string | null = null
let rebuildTimer: NodeJS.Timeout | null = null
let syncTimer: NodeJS.Timeout | null = null

function focusedContentsId(): number | null {
	return listMainWindows().find((entry) => entry.focused)?.contentsId ?? null
}

function focusedMenuState(): NativeMenuState | null {
	const contentsId = focusedContentsId()
	return contentsId === null ? null : (menuStates.get(contentsId) ?? null)
}

function commandsSignature(state: NativeMenuState | null): string {
	return JSON.stringify(state?.commands ?? [])
}

function emptyMenuState(): NativeMenuState {
	return { commands: [], checked: {}, enabled: {} }
}

function itemId(commandId: string, payload: Record<string, unknown> | undefined): string {
	return payload ? `${commandId}|${JSON.stringify(payload)}` : commandId
}

function isEnabled(context: MenuContext, id: string, requires?: Requirement): boolean {
	const { state } = context
	if (!state) return !requires
	if (state.enabled[id] === false) return false
	return requires ? state.enabled[requires] === true : true
}

function commandItem(
	context: MenuContext,
	id: string,
	options: CommandItemOptions = {},
): MenuItemConstructorOptions {
	const command = context.commands.get(id)
	const showShortcut = options.showShortcut ?? !options.payload
	const accelerator = showShortcut ? toAccelerator(command?.keys) : undefined
	const menuItemId = itemId(id, options.payload)
	pendingBindings.set(menuItemId, {
		commandId: id,
		requires: options.requires,
		checkedKey: options.checked,
	})
	return {
		id: menuItemId,
		label: options.label ?? command?.label ?? id,
		accelerator,
		registerAccelerator: false,
		enabled: isEnabled(context, id, options.requires),
		...(options.type && {
			type: options.type,
			checked: options.checked ? context.state?.checked[options.checked] === true : false,
		}),
		click: () =>
			emitToTargetWindow("menu-command", {
				id,
				...(options.payload && { payload: options.payload }),
			}),
	}
}

function openSettings(section?: string): void {
	emitToTargetWindow("menu-command", {
		id: "app.settings",
		...(section && { payload: { section } }),
	})
}

function separator(): MenuItemConstructorOptions {
	return { type: "separator" }
}

function recentsSubmenu(): MenuItemConstructorOptions {
	const entries = sortRecentVaults(readVaultRegistry()).slice(0, MAX_RECENTS)
	return {
		label: "Open Recent",
		submenu:
			entries.length === 0
				? [{ label: "No Recent Vaults", enabled: false }]
				: entries.map((entry) => ({
						label: entry.name,
						toolTip: entry.path,
						click: () => openVaultWindow(entry.path),
					})),
	}
}

function appMenu(context: MenuContext): MenuItemConstructorOptions {
	return {
		label: app.name,
		submenu: [
			{ role: "about" },
			commandItem(context, "app.check-updates", { label: "Check for Updates…" }),
			separator(),
			{
				label: "Settings…",
				accelerator: "CmdOrCtrl+,",
				click: () => openSettings(),
			},
			separator(),
			{ role: "services" },
			separator(),
			{ role: "hide" },
			{ role: "hideOthers" },
			{ role: "unhide" },
			separator(),
			{ role: "quit" },
		],
	}
}

function fileMenu(context: MenuContext): MenuItemConstructorOptions {
	return {
		label: "File",
		submenu: [
			commandItem(context, "file.new", { label: "New Note", requires: "vault" }),
			commandItem(context, "templates.create-note", {
				label: "New Note from Template…",
				requires: "vault",
			}),
			commandItem(context, "database.new", { label: "New Database…", requires: "vault" }),
			commandItem(context, "tabs.new", { label: "New Tab", requires: "vault" }),
			{
				label: "New Window",
				accelerator: toAccelerator(context.commands.get("window.new")?.keys) ?? "CmdOrCtrl+Shift+N",
				registerAccelerator: false,
				click: () => openNewWindow(),
			},
			separator(),
			commandItem(context, "vault.add", { label: "Add Vault…" }),
			commandItem(context, "vault.open", { label: "Open Vault…" }),
			recentsSubmenu(),
			commandItem(context, "navigate.quick-finder", { label: "Quick Open…", requires: "vault" }),
			separator(),
			commandItem(context, "file.close-tab", { label: "Close Tab", requires: "vault" }),
			{ role: "close", label: "Close Window", accelerator: "CmdOrCtrl+Shift+W" },
			commandItem(context, "file.reopen-closed", {
				label: "Reopen Closed Tab",
				requires: "vault",
			}),
			separator(),
			commandItem(context, "file.duplicate", { label: "Duplicate", requires: "note" }),
			commandItem(context, "file.delete", { label: "Delete Note", requires: "note" }),
			separator(),
			commandItem(context, "file.reveal", {
				label: process.platform === "darwin" ? "Reveal in Finder" : "Show in Folder",
				requires: "note",
			}),
			{
				label: "Copy Path",
				submenu: [
					commandItem(context, "file.copy-relative-path", {
						label: "Relative Path",
						requires: "note",
					}),
					commandItem(context, "file.copy-absolute-path", {
						label: "Absolute Path",
						requires: "note",
					}),
				],
			},
			separator(),
			commandItem(context, "import.files", { label: "Import…", requires: "vault" }),
			commandItem(context, "import.obsidian", {
				label: "Import from Obsidian…",
				requires: "vault",
			}),
			{
				label: "Export",
				submenu: [
					commandItem(context, "export.active-html", { label: "HTML…", requires: "note" }),
					commandItem(context, "export.active-pdf", { label: "PDF…", requires: "note" }),
					commandItem(context, "export.active-csv", { label: "CSV…", requires: "note" }),
				],
			},
			separator(),
			commandItem(context, "vault.close", { label: "Close Vault", requires: "vault" }),
			...(!context.isMac
				? [
						separator(),
						{
							label: "Settings…",
							accelerator: "CmdOrCtrl+,",
							registerAccelerator: false,
							click: () => openSettings(),
						},
						separator(),
						{ role: "quit" as const },
					]
				: []),
		],
	}
}

function editMenu(context: MenuContext): MenuItemConstructorOptions {
	return {
		label: "Edit",
		submenu: [
			{ role: "undo" },
			{ role: "redo" },
			separator(),
			{ role: "cut" },
			{ role: "copy" },
			{ role: "paste" },
			{ role: "pasteAndMatchStyle" },
			{ role: "selectAll" },
			separator(),
			commandItem(context, "editor.find", { label: "Find in Note", requires: "editor" }),
			commandItem(context, "view.search", { label: "Search in Vault", requires: "vault" }),
			separator(),
			commandItem(context, "editor.copy-line", { label: "Copy Line", requires: "editor" }),
			commandItem(context, "editor.duplicate-line", {
				label: "Duplicate Line",
				requires: "editor",
			}),
			...(context.isMac
				? [separator(), { role: "startSpeaking" as const }, { role: "stopSpeaking" as const }]
				: []),
		],
	}
}

function formatMenu(context: MenuContext): MenuItemConstructorOptions {
	const editor = (id: string, label?: string) =>
		commandItem(context, id, { label, requires: "editor" })
	return {
		label: "Format",
		submenu: [
			editor("format.bold", "Bold"),
			editor("format.italic", "Italic"),
			editor("format.strikethrough", "Strikethrough"),
			editor("format.inline-code", "Inline Code"),
			editor("format.link", "Link"),
			separator(),
			{
				label: "Heading",
				submenu: [
					editor("editor.turn-into-text", "Normal Text"),
					editor("format.heading-1", "Heading 1"),
					editor("format.heading-2", "Heading 2"),
					editor("format.heading-3", "Heading 3"),
				],
			},
			{
				label: "List",
				submenu: [
					editor("format.unordered-list", "Bulleted List"),
					editor("format.ordered-list", "Numbered List"),
					editor("format.task-list", "Task List"),
				],
			},
			separator(),
			editor("format.blockquote", "Quote"),
			editor("format.code-block", "Code Block"),
			editor("format.callout", "Callout"),
			editor("format.math-block", "Math Block"),
			editor("format.inline-math", "Inline Math"),
			separator(),
			editor("format.table", "Insert Table"),
			{
				label: "Table",
				submenu: [
					editor("table.add-row-above", "Add Row Above"),
					editor("table.add-row-below", "Add Row Below"),
					editor("table.add-column-left", "Add Column Left"),
					editor("table.add-column-right", "Add Column Right"),
					separator(),
					editor("table.delete-row", "Delete Row"),
					editor("table.delete-column", "Delete Column"),
				],
			},
			editor("format.image", "Insert Image"),
			editor("format.drawing", "Insert Drawing"),
			separator(),
			editor("comments.add", "Add Comment"),
		],
	}
}

function viewMenu(context: MenuContext): MenuItemConstructorOptions {
	const sidebarView = (id: string, label: string, key: string) =>
		commandItem(context, id, { label, requires: "vault", type: "radio", checked: key })
	return {
		label: "View",
		submenu: [
			commandItem(context, "view.toggle-sidebar", {
				label: "Left Sidebar",
				requires: "vault",
				type: "checkbox",
				checked: "leftSidebar",
			}),
			commandItem(context, "view.toggle-writing-mode", {
				label: "Writing Mode",
				requires: "vault",
				type: "checkbox",
				checked: "writingMode",
			}),
			commandItem(context, "view.toggle-ribbon", {
				label: "Ribbon",
				requires: "vault",
				type: "checkbox",
				checked: "ribbon",
			}),
			commandItem(context, "view.toggle-right-sidebar", {
				label: "Right Sidebar",
				requires: "vault",
				type: "checkbox",
				checked: "rightSidebar",
			}),
			separator(),
			sidebarView("view.files", "Files", "sidebar:files"),
			sidebarView("view.search", "Search", "sidebar:search"),
			sidebarView("view.bookmarks", "Bookmarks", "sidebar:bookmarks"),
			sidebarView("view.tags", "Tags", "sidebar:tags"),
			separator(),
			commandItem(context, "view.comments", { label: "Comments", requires: "vault" }),
			commandItem(context, "view.outline", { label: "Outline", requires: "vault" }),
			commandItem(context, "view.backlinks", { label: "Backlinks", requires: "vault" }),
			separator(),
			{
				label: "Editor Mode",
				submenu: [
					...EDITOR_MODES.map(([mode, label]) =>
						commandItem(context, "editor.set-mode", {
							label,
							payload: { mode },
							requires: "note",
							type: "radio",
							checked: `mode:${mode}`,
						}),
					),
					separator(),
					commandItem(context, "editor.toggle-mode", { label: "Next Mode", requires: "note" }),
				],
			},
			...EDITOR_TOGGLES.map(([key, label]) =>
				commandItem(context, "editor.toggle-setting", {
					label,
					payload: { key },
					requires: "vault",
					type: "checkbox",
					checked: `setting:${key}`,
				}),
			),
			{
				label: "Folding",
				submenu: [
					commandItem(context, "editor.toggle-fold", { label: "Toggle Fold", requires: "editor" }),
					commandItem(context, "editor.fold-all", { label: "Fold All", requires: "editor" }),
					commandItem(context, "editor.unfold-all", { label: "Unfold All", requires: "editor" }),
				],
			},
			separator(),
			{
				label: "Appearance",
				submenu: [
					...COLOR_SCHEMES.map(([scheme, label]) =>
						commandItem(context, "appearance.set-colorscheme", {
							label,
							payload: { scheme },
							requires: "vault",
							type: "radio",
							checked: `colorscheme:${scheme}`,
						}),
					),
					separator(),
					commandItem(context, "view.toggle-theme", {
						label: "Toggle Light/Dark",
						requires: "vault",
					}),
				],
			},
			commandItem(context, "view.zoom-in", { label: "Zoom In", requires: "vault" }),
			commandItem(context, "view.zoom-out", { label: "Zoom Out", requires: "vault" }),
			commandItem(context, "view.zoom-reset", { label: "Actual Size", requires: "vault" }),
			separator(),
			{ role: "togglefullscreen" },
			...(app.isPackaged
				? []
				: [
						separator(),
						{ role: "reload" as const },
						{ role: "forceReload" as const },
						{ role: "toggleDevTools" as const },
					]),
		],
	}
}

function goMenu(context: MenuContext): MenuItemConstructorOptions {
	return {
		label: "Go",
		submenu: [
			commandItem(context, "navigate.back", { label: "Back", requires: "vault" }),
			commandItem(context, "navigate.forward", { label: "Forward", requires: "vault" }),
			separator(),
			commandItem(context, "navigate.quick-finder", { label: "Quick Finder…", requires: "vault" }),
			commandItem(context, "navigate.command-palette", {
				label: "Command Palette…",
				requires: "vault",
			}),
			commandItem(context, "navigate.daily-note", { label: "Daily Note", requires: "vault" }),
			separator(),
			commandItem(context, "navigate.mru-next", { label: "Next Tab", requires: "vault" }),
			commandItem(context, "navigate.mru-prev", { label: "Previous Tab", requires: "vault" }),
			{
				label: "Go to Tab",
				submenu: Array.from({ length: 9 }, (_, index) =>
					commandItem(context, `navigate.tab-${index + 1}`, {
						label: `Tab ${index + 1}`,
						requires: "vault",
					}),
				),
			},
			separator(),
			commandItem(context, "marketplace.open", { label: "Marketplace", requires: "vault" }),
		],
	}
}

function noteMenu(context: MenuContext): MenuItemConstructorOptions {
	const note = (id: string, options: CommandItemOptions = {}) =>
		commandItem(context, id, { requires: "note", ...options })
	return {
		label: "Note",
		submenu: [
			note("bookmarks.toggle", { label: "Bookmark", type: "checkbox", checked: "bookmarked" }),
			note("tags.toggle-picker", { label: "Add Tag…" }),
			separator(),
			note("file.open-in-new-tab", { label: "Open in New Tab" }),
			note("file.open-in-right-split", { label: "Open in Right Split" }),
			note("tabs.toggle-pin", { label: "Pin Tab" }),
			note("tabs.close-others", { label: "Close Other Tabs" }),
			separator(),
			note("sync.show-version-history", { label: "Version History…" }),
			note("sync.share-note", { label: "Share Note…" }),
			note("sync.manage-access", { label: "Manage Access…" }),
			note("sync.toggle-excluded", {
				label: "Exclude from Sync",
				type: "checkbox",
				checked: "syncExcluded",
			}),
		],
	}
}

function syncMenu(context: MenuContext): MenuItemConstructorOptions {
	return {
		label: "Sync",
		submenu: [
			commandItem(context, "sync.now", { label: "Sync Now", requires: "vault" }),
			separator(),
			commandItem(context, "sync.open-logs", { label: "Sync Logs…", requires: "vault" }),
			commandItem(context, "sync.open-deleted", { label: "Deleted Notes…", requires: "vault" }),
			separator(),
			commandItem(context, "sync.settings", { label: "Sync Settings…" }),
		],
	}
}

function pluginsMenu(context: MenuContext): MenuItemConstructorOptions {
	const pluginCommands = [...context.commands.values()].filter((command) =>
		command.id.includes(":"),
	)
	const byPlugin = new Map<string, NativeMenuCommand[]>()
	for (const command of pluginCommands) {
		const pluginId = command.id.slice(0, command.id.indexOf(":"))
		byPlugin.set(pluginId, [...(byPlugin.get(pluginId) ?? []), command])
	}
	const pluginSubmenus: MenuItemConstructorOptions[] = [...byPlugin].map(
		([pluginId, commands]) => ({
			label: commands[0]?.category || pluginId,
			submenu: commands.map((command) =>
				commandItem(context, command.id, { label: command.label, requires: "vault" }),
			),
		}),
	)
	return {
		label: "Plugins",
		submenu: [
			...pluginSubmenus,
			...(pluginSubmenus.length > 0 ? [separator()] : []),
			{ label: "Manage Plugins…", click: () => openSettings("plugins") },
			commandItem(context, "marketplace.open-plugins", {
				label: "Browse Plugins…",
				requires: "vault",
			}),
			commandItem(context, "marketplace.open-themes", {
				label: "Browse Themes…",
				requires: "vault",
			}),
		],
	}
}

function windowMenu(context: MenuContext): MenuItemConstructorOptions {
	return {
		label: "Window",
		role: "windowMenu",
		submenu: [
			{ role: "minimize" },
			{ role: "zoom" },
			separator(),
			{ label: "New Window", click: () => openNewWindow() },
			...(context.isMac ? [separator(), { role: "front" as const }] : []),
		],
	}
}

function helpMenu(context: MenuContext): MenuItemConstructorOptions {
	return {
		label: "Help",
		role: "help",
		submenu: [
			commandItem(context, "help.open-docs", { label: "Cortex Help" }),
			commandItem(context, "app.whats-new", { label: "What's New", requires: "vault" }),
			{ label: "Keyboard Shortcuts", click: () => openSettings("hotkeys") },
			separator(),
			commandItem(context, "help.report-issue", { label: "Report an Issue…" }),
			...(!context.isMac
				? [
						separator(),
						commandItem(context, "app.check-updates", { label: "Check for Updates…" }),
						{ role: "about" as const },
					]
				: []),
		],
	}
}

function collectBindings(menu: Menu, bindings: LiveItemBinding[]): void {
	for (const item of menu.items) {
		const binding = item.id ? pendingBindings.get(item.id) : undefined
		if (binding) bindings.push({ ...binding, item })
		if (item.submenu) collectBindings(item.submenu, bindings)
	}
}

function applyItemStates(): void {
	const state = focusedMenuState()
	const context: MenuContext = {
		state,
		commands: new Map(),
		isMac: process.platform === "darwin",
	}
	for (const binding of liveBindings) {
		binding.item.enabled = isEnabled(context, binding.commandId, binding.requires)
		if (binding.checkedKey) {
			binding.item.checked = state?.checked[binding.checkedKey] === true
		}
	}
}

function buildApplicationMenu(): Menu {
	const state = focusedMenuState()
	const context: MenuContext = {
		state,
		commands: new Map((state?.commands ?? []).map((command) => [command.id, command])),
		isMac: process.platform === "darwin",
	}
	pendingBindings.clear()
	const menu = Menu.buildFromTemplate([
		...(context.isMac ? [appMenu(context)] : []),
		fileMenu(context),
		editMenu(context),
		formatMenu(context),
		viewMenu(context),
		goMenu(context),
		noteMenu(context),
		syncMenu(context),
		pluginsMenu(context),
		windowMenu(context),
		helpMenu(context),
	])
	const bindings: LiveItemBinding[] = []
	collectBindings(menu, bindings)
	liveBindings = bindings
	pendingBindings.clear()
	builtCommandsSignature = commandsSignature(state)
	return menu
}

export function setupApplicationMenu(): void {
	if (rebuildTimer) clearTimeout(rebuildTimer)
	rebuildTimer = null
	Menu.setApplicationMenu(buildApplicationMenu())
	setupDockMenu()
}

function scheduleMenuRebuild(): void {
	if (rebuildTimer) clearTimeout(rebuildTimer)
	rebuildTimer = setTimeout(setupApplicationMenu, REBUILD_DELAY_MS)
}

export function syncApplicationMenu(): void {
	if (syncTimer) clearTimeout(syncTimer)
	syncTimer = setTimeout(() => {
		syncTimer = null
		if (rebuildTimer) return
		if (commandsSignature(focusedMenuState()) !== builtCommandsSignature) setupApplicationMenu()
		else applyItemStates()
	}, REBUILD_DELAY_MS)
}

export function forgetMenuState(contentsId: number): void {
	menuStates.delete(contentsId)
}

function senderMenuState(): { contentsId: number; state: NativeMenuState } | null {
	const sender = getInvokeSender()
	const contentsId = sender ? resolveMainWindowId(sender.id) : null
	if (contentsId === null || contentsId !== sender?.id) return null
	const state = menuStates.get(contentsId) ?? emptyMenuState()
	menuStates.set(contentsId, state)
	return { contentsId, state }
}

export const menuApi = {
	setCommands: async (commands) => {
		const target = senderMenuState()
		if (!target) return
		target.state.commands = commands
		if (target.contentsId !== focusedContentsId()) return
		if (commandsSignature(target.state) !== builtCommandsSignature) scheduleMenuRebuild()
	},
	setItemStates: async (states: NativeMenuItemStates) => {
		const target = senderMenuState()
		if (!target) return
		target.state.checked = states.checked
		target.state.enabled = states.enabled
		if (target.contentsId === focusedContentsId() && !rebuildTimer) applyItemStates()
	},
} satisfies MainApi["menu"]
