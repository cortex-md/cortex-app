import {
	refreshTeamTemplates,
	useAuthStore,
	useRemoteVaultStore,
	useVaultStore,
} from "@cortex/core"
import { useSettingsStore } from "@cortex/settings"
import { useEffect } from "react"

const focusRefreshInterval = 60_000

export function useTeamTemplates(): void {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const userId = useAuthStore((state) => state.user?.userId ?? null)
	const remoteVaultId = useRemoteVaultStore((state) =>
		state.syncConfig.enabled ? state.syncConfig.remoteVaultId : null,
	)
	const showTeam = useSettingsStore((state) => state.settings.templates.showTeam)

	const refreshKey = vaultPath ? [vaultPath, remoteVaultId, userId, showTeam].join("|") : null

	useEffect(() => {
		if (!refreshKey) return
		let lastRefresh = Date.now()
		void refreshTeamTemplates()
		const onFocus = () => {
			if (Date.now() - lastRefresh < focusRefreshInterval) return
			lastRefresh = Date.now()
			void refreshTeamTemplates()
		}
		window.addEventListener("focus", onFocus)
		return () => window.removeEventListener("focus", onFocus)
	}, [refreshKey])
}
