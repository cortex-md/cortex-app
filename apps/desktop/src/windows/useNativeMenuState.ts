import { commandRegistry } from "@cortex/commands"
import { useHotkeysStore } from "@cortex/commands/hotkeys"
import {
	canReadVaultPath,
	toVaultRelativePath,
	useBookmarksStore,
	useEditorStore,
	useSyncStore,
	useUIStore,
	useVaultStore,
} from "@cortex/core"
import { getPlatform, type NativeMenuCommand, type NativeMenuItemStates } from "@cortex/platform"
import { useSettingsStore } from "@cortex/settings"
import { useEffect } from "react"

const COMMANDS_DELAY_MS = 150
const STATES_DELAY_MS = 30
const MENU_EDITOR_SETTINGS = ["wordWrap", "showLineNumbers", "vimMode"] as const

function buildCommands(): NativeMenuCommand[] {
	const bindings = new Map(
		useHotkeysStore.getState().bindings.map((binding) => [binding.id, binding]),
	)
	return commandRegistry.getAll().map((command) => {
		const binding = bindings.get(command.id)
		return {
			id: command.id,
			label: command.label,
			category: command.category,
			keys: binding?.enabled && binding.keys ? binding.keys : null,
			scope: binding?.scope ?? command.hotkey?.scope ?? "global",
		}
	})
}

function isSyncExcluded(filePath: string, vaultPath: string): boolean {
	const relativePath = toVaultRelativePath(filePath, vaultPath)
	if (!relativePath) return false
	return useSyncStore.getState().syncPreferences.excludedPaths.includes(relativePath)
}

function buildItemStates(): NativeMenuItemStates {
	const vault = useVaultStore.getState().vault
	const { activeFilePath, mode } = useEditorStore.getState()
	const ui = useUIStore.getState()
	const { editor, appearance } = useSettingsStore.getState().settings
	const notePath = vault ? activeFilePath : null

	const checked: Record<string, boolean> = {
		leftSidebar: !ui.leftSidebarCollapsed,
		rightSidebar: !ui.rightSidebarCollapsed,
		[`sidebar:${ui.leftSidebarView}`]: true,
		[`mode:${mode}`]: true,
		[`colorscheme:${appearance.colorscheme}`]: true,
		bookmarked: Boolean(
			vault && notePath && useBookmarksStore.getState().isBookmarked(vault.path, notePath),
		),
		syncExcluded: Boolean(vault && notePath && isSyncExcluded(notePath, vault.path)),
	}
	for (const key of MENU_EDITOR_SETTINGS) checked[`setting:${key}`] = editor[key]

	return {
		checked,
		enabled: {
			vault: vault !== null,
			note: notePath !== null,
			editor: notePath !== null && mode !== "reading",
			"sync.show-version-history": notePath !== null && canReadVaultPath(notePath),
		},
	}
}

function createDebouncedSender<T>(
	delayMs: number,
	build: () => T,
	send: (value: T) => Promise<void>,
): { schedule: () => void; cancel: () => void } {
	let timer = 0
	let lastSignature = ""
	return {
		schedule: () => {
			window.clearTimeout(timer)
			timer = window.setTimeout(() => {
				const value = build()
				const signature = JSON.stringify(value)
				if (signature === lastSignature) return
				lastSignature = signature
				void send(value)
			}, delayMs)
		},
		cancel: () => window.clearTimeout(timer),
	}
}

export function useNativeMenuState(): void {
	useEffect(() => {
		const menu = getPlatform().menu
		const commands = createDebouncedSender(COMMANDS_DELAY_MS, buildCommands, (value) =>
			menu.setCommands(value),
		)
		const states = createDebouncedSender(STATES_DELAY_MS, buildItemStates, (value) =>
			menu.setItemStates(value),
		)
		const unsubscribes = [
			commandRegistry.subscribe(commands.schedule),
			useHotkeysStore.subscribe((state, previous) => {
				if (state.bindings !== previous.bindings) commands.schedule()
			}),
			useVaultStore.subscribe((state, previous) => {
				if (state.vault !== previous.vault) states.schedule()
			}),
			useEditorStore.subscribe((state, previous) => {
				if (state.activeFilePath !== previous.activeFilePath || state.mode !== previous.mode) {
					states.schedule()
				}
			}),
			useUIStore.subscribe((state, previous) => {
				if (
					state.leftSidebarCollapsed !== previous.leftSidebarCollapsed ||
					state.rightSidebarCollapsed !== previous.rightSidebarCollapsed ||
					state.leftSidebarView !== previous.leftSidebarView
				) {
					states.schedule()
				}
			}),
			useSettingsStore.subscribe((state, previous) => {
				if (
					state.settings.editor !== previous.settings.editor ||
					state.settings.appearance.colorscheme !== previous.settings.appearance.colorscheme
				) {
					states.schedule()
				}
			}),
			useBookmarksStore.subscribe(states.schedule),
			useSyncStore.subscribe((state, previous) => {
				if (state.syncPreferences !== previous.syncPreferences) states.schedule()
			}),
		]
		window.addEventListener("focus", states.schedule)
		commands.schedule()
		states.schedule()
		return () => {
			commands.cancel()
			states.cancel()
			window.removeEventListener("focus", states.schedule)
			for (const unsubscribe of unsubscribes) unsubscribe()
		}
	}, [])
}
