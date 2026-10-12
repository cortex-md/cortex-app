import { useAccountStore, useMembersStore, useRemoteVaultStore } from "@cortex/core"
import { useEffect } from "react"

export function useLinkedVaultRole(): { vaultId: string | null; role: string | null } {
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const remoteRole = useRemoteVaultStore(
		(state) => state.remoteVaults.find((vault) => vault.id === linkedVaultId)?.role ?? null,
	)
	const overviewRole = useMembersStore((state) =>
		state.overviewVaultId === linkedVaultId ? state.myRole : null,
	)
	return { vaultId: linkedVaultId, role: overviewRole ?? remoteRole }
}

export function useLinkedVaultOverview(vaultId: string | null): void {
	const fetchOverview = useMembersStore((state) => state.fetchOverview)
	const ensureCapabilities = useAccountStore((state) => state.ensureCapabilities)
	// oxlint-disable-next-line react-doctor/no-event-handler -- access data loads for the linked vault when a sharing surface opens
	useEffect(() => {
		void ensureCapabilities()
		if (vaultId) void fetchOverview(vaultId)
	}, [ensureCapabilities, fetchOverview, vaultId])
}
