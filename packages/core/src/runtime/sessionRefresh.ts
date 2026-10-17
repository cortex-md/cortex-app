import { getPlatform } from "@cortex/platform"
import { useAuthStore } from "../stores/authStore"
import { useMembersStore } from "../stores/membersStore"
import { refreshTeamTemplates } from "./templateSharing"

export type SubscribeAppActive = (listener: () => void) => () => void

const focusRefreshInterval = 60_000

export function teamTemplatesRefreshKey(input: {
	vaultPath: string | null
	remoteVaultId: string | null
	userId: string | null
	showTeam: boolean
}): string | null {
	const { vaultPath, remoteVaultId, userId, showTeam } = input
	return vaultPath ? [vaultPath, remoteVaultId, userId, showTeam].join("|") : null
}

export function startTeamTemplatesRefresh(onAppActive: SubscribeAppActive): () => void {
	let lastRefresh = Date.now()
	void refreshTeamTemplates()
	const onFocus = () => {
		if (Date.now() - lastRefresh < focusRefreshInterval) return
		lastRefresh = Date.now()
		void refreshTeamTemplates()
	}
	return onAppActive(onFocus)
}

const FOCUS_REFRESH_INTERVAL_MS = 60_000

export function startVaultOverviewRefresh(
	linkedVaultId: string,
	onAppActive: SubscribeAppActive,
): () => void {
	let lastRefresh = Date.now()
	void useMembersStore.getState().fetchOverview(linkedVaultId)
	const refreshOnFocus = () => {
		if (Date.now() - lastRefresh < FOCUS_REFRESH_INTERVAL_MS) return
		lastRefresh = Date.now()
		void useMembersStore.getState().fetchOverview(linkedVaultId)
	}
	return onAppActive(refreshOnFocus)
}

export function startAuthSession(): () => void {
	const { loadPreferences, checkAuth } = useAuthStore.getState()
	void loadPreferences().then(() => checkAuth())

	return getPlatform().app.onNativeEvent("auth-session-expired", () => {
		void useAuthStore.getState().logout()
	})
}
