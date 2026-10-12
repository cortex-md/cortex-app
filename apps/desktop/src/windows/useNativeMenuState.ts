import { commandRegistry } from "@cortex/commands"
import {
	canReadVaultPath,
	toVaultRelativePath,
	useBookmarksStore,
	useEditorStore,
	useSyncStore,
	useUIStore,
	useVaultStore,
} from "@cortex/core"
import { useHotkeysStore } from "@cortex/hotkeys"
import { getPlatform, type NativeMenuState } from "@cortex/platform"
import { useSettingsStore } from "@cortex/settings"
import { useEffect } from "react"

const SEND_DELAY_MS = 150
const MENU_EDITOR_SETTINGS = ["wordWrap", "showLineNumbers", "vimMode"] as const

function buildCommands(): NativeMenuState["commands"] {
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

function buildMenuState(): NativeMenuState {
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
		commands: buildCommands(),
		checked,
		enabled: {
			vault: vault !== null,
			note: notePath !== null,
			editor: notePath !== null && mode !== "reading",
			"sync.show-version-history": notePath !== null && canReadVaultPath(notePath),
		},
	}
}

export function useNativeMenuState(): void {
	useEffect(() => {
		let timer = 0
		const send = () => {
			window.clearTimeout(timer)
			timer = window.setTimeout(() => {
				void getPlatform().menu.setState(buildMenuState())
			}, SEND_DELAY_MS)
		}
		const unsubscribes = [
			commandRegistry.subscribe(send),
			useHotkeysStore.subscribe(send),
			useVaultStore.subscribe((state, previous) => {
				if (state.vault !== previous.vault) send()
			}),
			useEditorStore.subscribe((state, previous) => {
				if (state.activeFilePath !== previous.activeFilePath || state.mode !== previous.mode) send()
			}),
			useUIStore.subscribe(send),
			useSettingsStore.subscribe(send),
			useBookmarksStore.subscribe(send),
			useSyncStore.subscribe((state, previous) => {
				if (state.syncPreferences !== previous.syncPreferences) send()
			}),
		]
		window.addEventListener("focus", send)
		send()
		return () => {
			window.clearTimeout(timer)
			window.removeEventListener("focus", send)
			for (const unsubscribe of unsubscribes) unsubscribe()
		}
	}, [])
}
