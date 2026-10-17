import {
	createCoreServices,
	type EditorMode,
	useBookmarksStore,
	useEditorStore,
	useTagsStore,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { createEditorConfig } from "@cortex/editor/editor-config"
import { useHotkeysStore } from "@cortex/commands/hotkeys"
import { getPlatform } from "@cortex/platform"
import { type AppSettings, useSettingsStore } from "@cortex/settings"
import { getThemeManager } from "@cortex/theme"

import type { MobileEditorConfig } from "@/features/editor/editorContract"
import { createEditorThemeTokens } from "@/features/editor/editorTheme"
import type { WorkspaceState } from "@/features/workspace/workspaceProtocol"

const coreServices = createCoreServices()

function memoize<T>(readDependencies: () => unknown[], compute: () => T): () => T {
	let dependencies: unknown[] | null = null
	let value: T
	return () => {
		const next = readDependencies()
		if (dependencies?.every((dependency, index) => Object.is(dependency, next[index]))) {
			return value
		}
		dependencies = next
		value = compute()
		return value
	}
}

function createMobileEditorConfig(settings: AppSettings, mode: EditorMode): MobileEditorConfig {
	return {
		...createEditorConfig(settings),
		livePreview: mode !== "source",
		readOnly: mode === "reading",
		slashCommands: settings.editor.slashCommands,
	}
}

const getSettings = () => useSettingsStore.getState().settings

const readers: { [Key in keyof WorkspaceState]: () => WorkspaceState[Key] } = {
	vaultPath: coreServices.getVaultPath,
	openFiles: memoize(
		() => [useWorkspaceStore.getState().panes],
		coreServices.workspace.getOpenFiles,
	),
	activeFilePath: () => useEditorStore.getState().activeFilePath,
	bookmarks: () => useBookmarksStore.getState().bookmarks,
	bookmarkedPaths: () => useBookmarksStore.getState().bookmarkedPaths,
	tags: memoize(() => [useTagsStore.getState().tagIndex], coreServices.metadata.getAllTags),
	themeName: () => getThemeManager().getActiveTheme().name,
	editorConfig: memoize(
		() => [
			getSettings().editor,
			getSettings().appearance.editorFontSize,
			useEditorStore.getState().mode,
		],
		() => createMobileEditorConfig(getSettings(), useEditorStore.getState().mode),
	),
	themeTokens: memoize(
		() => [getThemeManager().getActiveTheme(), getSettings().appearance],
		() => createEditorThemeTokens(getThemeManager().getActiveTheme(), getSettings().appearance),
	),
	hotkeyOverrides: () => useHotkeysStore.getState().overrides,
	capabilities: () => getPlatform().capabilities,
	allowCommunityPlugins: () => getSettings().plugins.allowCommunity,
}

const stateKeys = Object.keys(readers) as (keyof WorkspaceState)[]

function readWorkspaceState(): WorkspaceState {
	const state = {} as Record<keyof WorkspaceState, unknown>
	for (const key of stateKeys) state[key] = readers[key]()
	return state as WorkspaceState
}

function isSameValue(left: unknown, right: unknown): boolean {
	return Object.is(left, right) || JSON.stringify(left) === JSON.stringify(right)
}

export interface WorkspaceStatePublisher {
	/** The full state; later patches are diffs against it. */
	snapshot(): WorkspaceState
	stop(): void
}

/** Sends only the keys whose value changed since the last snapshot or patch. */
export function startWorkspaceStatePublisher(
	sendPatch: (patch: Partial<WorkspaceState>) => void,
): WorkspaceStatePublisher {
	let published = readWorkspaceState()

	function publishChanges(): void {
		const next = readWorkspaceState()
		const changedKeys = stateKeys.filter((key) => !isSameValue(next[key], published[key]))
		published = next
		if (changedKeys.length === 0) return
		sendPatch(Object.fromEntries(changedKeys.map((key) => [key, next[key]])))
	}

	const unsubscribers = [
		useVaultStore.subscribe(publishChanges),
		useWorkspaceStore.subscribe(publishChanges),
		useEditorStore.subscribe(publishChanges),
		useBookmarksStore.subscribe(publishChanges),
		useTagsStore.subscribe(publishChanges),
		useSettingsStore.subscribe(publishChanges),
		useHotkeysStore.subscribe(publishChanges),
		getThemeManager().subscribe(publishChanges),
	]

	return {
		snapshot() {
			published = readWorkspaceState()
			return published
		},
		stop() {
			for (const unsubscribe of unsubscribers) unsubscribe()
		},
	}
}
