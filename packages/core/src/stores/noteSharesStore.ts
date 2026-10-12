import type { NoteShareInfo, SharedNoteBundle } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"

export interface NoteSharesState {
	vaultId: string | null
	sharesByPath: Record<string, NoteShareInfo>
	loading: boolean
	error: string | null

	fetchShares: (vaultId: string) => Promise<void>
	publish: (
		vaultId: string,
		filePath: string,
		bundle: SharedNoteBundle,
		expiresAt?: string | null,
	) => Promise<NoteShareInfo>
	updateExpiry: (vaultId: string, shareId: string, expiresAt: string | null) => Promise<void>
	revoke: (vaultId: string, shareId: string) => Promise<void>
	movePath: (oldPath: string, newPath: string) => void
	clear: () => void
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

export const useNoteSharesStore = create<NoteSharesState>()(
	devtools(
		immer((set, get) => {
			const store = (share: NoteShareInfo) =>
				set((state) => {
					if (state.vaultId === share.vaultId) state.sharesByPath[share.filePath] = share
				})

			const run = async <T>(task: () => Promise<T>): Promise<T> => {
				set((state) => {
					state.error = null
				})
				try {
					return await task()
				} catch (error) {
					set((state) => {
						state.error = messageOf(error)
					})
					throw error
				}
			}

			return {
				vaultId: null,
				sharesByPath: {},
				loading: false,
				error: null,

				fetchShares: async (vaultId) => {
					set((state) => {
						if (state.vaultId !== vaultId) state.sharesByPath = {}
						state.vaultId = vaultId
						state.loading = true
					})
					try {
						const shares = await run(() => getPlatform().shares.list(vaultId))
						set((state) => {
							if (state.vaultId !== vaultId) return
							state.sharesByPath = Object.fromEntries(
								shares.map((share) => [share.filePath, share]),
							)
						})
					} finally {
						set((state) => {
							state.loading = false
						})
					}
				},

				publish: async (vaultId, filePath, bundle, expiresAt) => {
					const share = await run(() =>
						getPlatform().shares.publish(vaultId, filePath, bundle, expiresAt),
					)
					store(share)
					return share
				},

				updateExpiry: async (vaultId, shareId, expiresAt) => {
					store(await run(() => getPlatform().shares.updateExpiry(vaultId, shareId, expiresAt)))
				},

				revoke: async (vaultId, shareId) => {
					await run(() => getPlatform().shares.revoke(vaultId, shareId))
					set((state) => {
						for (const [path, share] of Object.entries(state.sharesByPath)) {
							if (share.id === shareId) delete state.sharesByPath[path]
						}
					})
				},

				movePath: (oldPath, newPath) => {
					const share = get().sharesByPath[oldPath]
					if (!share) return
					set((state) => {
						delete state.sharesByPath[oldPath]
						state.sharesByPath[newPath] = { ...share, filePath: newPath }
					})
				},

				clear: () =>
					set((state) => {
						state.vaultId = null
						state.sharesByPath = {}
						state.error = null
					}),
			}
		}),
		{ name: "noteSharesStore" },
	),
)
