import { getPlatform, type SharedNoteBundle } from "@cortex/platform"
import { joinPath } from "@cortex/platform/utils"
import { useAccountStore } from "../stores/accountStore"
import { useNoteSharesStore } from "../stores/noteSharesStore"
import { useRemoteVaultStore } from "../stores/remoteVaultStore"
import { useSyncLogStore } from "../stores/syncLogStore"
import { useVaultStore } from "../stores/vaultStore"

export type BuildSharedNoteBundle = (filePath: string) => Promise<SharedNoteBundle>

const REPUBLISH_DELAY_MS = 3_000
const REFRESH_DELAY_MS = 1_000

async function refreshShares(vaultId: string | null): Promise<void> {
	const shares = useNoteSharesStore.getState()
	if (!vaultId) {
		shares.clear()
		return
	}
	const capabilities = await useAccountStore.getState().ensureCapabilities()
	if (!capabilities?.features.publicLinks) return
	await shares.fetchShares(vaultId)
}

async function republish(
	path: string,
	buildSharedNoteBundle: BuildSharedNoteBundle,
): Promise<void> {
	const { vaultId, sharesByPath, publish } = useNoteSharesStore.getState()
	const vaultPath = useVaultStore.getState().vault?.path
	const share = sharesByPath[path]
	if (!vaultId || !vaultPath || !share?.link) return
	const bundle = await buildSharedNoteBundle(joinPath(vaultPath, path))
	await publish(vaultId, path, bundle)
}

export function startLiveNoteShares(buildSharedNoteBundle: BuildSharedNoteBundle): () => void {
	const uploading = new Set<string>()
	const timers = new Map<string, ReturnType<typeof setTimeout>>()
	const schedule = (key: string, delay: number, task: () => Promise<void>) => {
		clearTimeout(timers.get(key))
		timers.set(
			key,
			setTimeout(() => {
				timers.delete(key)
				void task().catch((error) => {
					useSyncLogStore
						.getState()
						.log(
							"warn",
							`Shared note update failed: ${error instanceof Error ? error.message : String(error)}`,
						)
				})
			}, delay),
		)
	}

	void refreshShares(useRemoteVaultStore.getState().linkedVaultId).catch(() => {})
	const unsubscribeVault = useRemoteVaultStore.subscribe((state, previous) => {
		if (state.linkedVaultId !== previous.linkedVaultId) {
			void refreshShares(state.linkedVaultId).catch(() => {})
		}
	})

	const unsubscribeSync = getPlatform().sync.onFileEvent(({ path, status }) => {
		if (status === "uploading") {
			uploading.add(path)
			return
		}
		if (status === "synced" && uploading.delete(path)) {
			if (useNoteSharesStore.getState().sharesByPath[path]) {
				schedule(path, REPUBLISH_DELAY_MS, () => republish(path, buildSharedNoteBundle))
			}
			return
		}
		if (status === "renaming-remote" || status === "deleting-remote") {
			schedule("refresh", REFRESH_DELAY_MS, () =>
				refreshShares(useRemoteVaultStore.getState().linkedVaultId),
			)
		}
	})

	return () => {
		unsubscribeVault()
		unsubscribeSync()
		for (const timer of timers.values()) clearTimeout(timer)
	}
}
