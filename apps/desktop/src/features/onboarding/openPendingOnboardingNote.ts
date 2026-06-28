import { useVaultStore, useWorkspaceStore } from "@cortex/core"

export function openPendingOnboardingNote(): void {
	const { clearPendingOnboardingNotePath, pendingOnboardingNotePath } = useVaultStore.getState()
	if (!pendingOnboardingNotePath) return
	useWorkspaceStore.getState().openTab(pendingOnboardingNotePath)
	clearPendingOnboardingNotePath()
}
