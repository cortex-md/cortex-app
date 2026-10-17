import { useSettingsStore, type WorkspaceMode } from "@cortex/settings"

export function useWorkspaceMode(): WorkspaceMode {
	return useSettingsStore((state) => state.settings.appearance.workspaceMode)
}

export function useWritingMode(): boolean {
	return useSettingsStore((state) => state.settings.appearance.workspaceMode === "writing")
}

export function getWorkspaceMode(): WorkspaceMode {
	return useSettingsStore.getState().settings.appearance.workspaceMode
}

export function setWorkspaceMode(mode: WorkspaceMode): void {
	if (getWorkspaceMode() === mode) return
	void useSettingsStore.getState().updateSetting("appearance", "workspaceMode", mode)
}

export function toggleWritingMode(): void {
	setWorkspaceMode(getWorkspaceMode() === "writing" ? "full" : "writing")
}
