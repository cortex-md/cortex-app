import {
	startTeamTemplatesRefresh,
	teamTemplatesRefreshKey,
	useAuthStore,
	useRemoteVaultStore,
	useVaultStore,
} from "@cortex/core"
import { useSettingsStore } from "@cortex/settings"
import { useEffect } from "react"
import { onWindowFocus } from "@/utils/windowFocus"

export function useTeamTemplates(): void {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const userId = useAuthStore((state) => state.user?.userId ?? null)
	const remoteVaultId = useRemoteVaultStore((state) =>
		state.syncConfig.enabled ? state.syncConfig.remoteVaultId : null,
	)
	const showTeam = useSettingsStore((state) => state.settings.templates.showTeam)

	const refreshKey = teamTemplatesRefreshKey({ vaultPath, remoteVaultId, userId, showTeam })

	useEffect(() => {
		if (!refreshKey) return
		return startTeamTemplatesRefresh(onWindowFocus)
	}, [refreshKey])
}
