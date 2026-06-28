import type { AcceptInviteResult, VaultInvite, VaultMember } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { requiresCloudEntitlement, resolveSyncServerUrl } from "../sync/serverConfig"
import { useSubscriptionStore } from "./subscriptionStore"

export interface MembersState {
	members: VaultMember[]
	memberCache: Record<string, VaultMember[]>
	activeMemberCacheKey: string | null
	invites: VaultInvite[]
	myInvites: VaultInvite[]
	loading: boolean
	error: string | null

	fetchMembers: (vaultId: string, serverUrl?: string) => Promise<void>
	ensureMembers: (vaultId: string, serverUrl?: string) => Promise<VaultMember[]>
	updateMemberRole: (vaultId: string, userId: string, role: string) => Promise<void>
	removeMember: (vaultId: string, userId: string) => Promise<void>
	fetchInvites: (vaultId: string) => Promise<void>
	createInvite: (
		vaultId: string,
		inviteeEmail: string,
		role: string,
		encryptedVaultKey: string,
	) => Promise<void>
	deleteInvite: (vaultId: string, inviteId: string) => Promise<void>
	fetchMyInvites: () => Promise<void>
	acceptInvite: (inviteId: string) => Promise<AcceptInviteResult>
	clearError: () => void
}

const memberLoads = new Map<string, Promise<VaultMember[]>>()

async function resolveServerUrl(serverUrl?: string): Promise<string> {
	if (serverUrl) return serverUrl.trim().replace(/\/+$/, "")
	const { useRemoteVaultStore } = await import("./remoteVaultStore")
	return resolveSyncServerUrl(useRemoteVaultStore.getState().syncConfig)
}

async function syncAuthContext(serverUrl: string): Promise<void> {
	const { useAuthStore } = await import("./authStore")
	await useAuthStore.getState().checkAuth(serverUrl || undefined)
}

async function ensureMemberMutationAllowed(): Promise<void> {
	const { useRemoteVaultStore } = await import("./remoteVaultStore")
	const syncConfig = useRemoteVaultStore.getState().syncConfig
	if (!requiresCloudEntitlement(syncConfig)) return
	await useSubscriptionStore.getState().ensureCloudEntitlement(resolveSyncServerUrl(syncConfig))
}

async function prepareMemberMutation(): Promise<void> {
	const serverUrl = await resolveServerUrl()
	await Promise.all([ensureMemberMutationAllowed(), syncAuthContext(serverUrl)])
}

export const useMembersStore = create<MembersState>()(
	devtools(
		immer((set, get) => {
			const loadMembers = async (
				vaultId: string,
				serverUrl: string | undefined,
				force: boolean,
			): Promise<VaultMember[]> => {
				const resolvedServerUrl = await resolveServerUrl(serverUrl)
				const cacheKey = `${resolvedServerUrl}:${vaultId}`
				const cached = get().memberCache[cacheKey]
				if (!force && cached) {
					set((state) => {
						state.members = cached
						state.activeMemberCacheKey = cacheKey
					})
					return cached
				}

				const existingLoad = memberLoads.get(cacheKey)
				if (existingLoad) return existingLoad

				set((state) => {
					state.loading = true
					state.error = null
					if (state.activeMemberCacheKey !== cacheKey) {
						state.members = []
						state.activeMemberCacheKey = cacheKey
					}
				})

				const load = (async () => {
					const platform = getPlatform()
					await syncAuthContext(resolvedServerUrl)
					const members = await platform.members.listMembers(vaultId)
					set((state) => {
						state.members = members
						state.memberCache[cacheKey] = members
						state.activeMemberCacheKey = cacheKey
						state.loading = false
					})
					return members
				})()
					.catch((error) => {
						const message = String(error)
						set((state) => {
							state.loading = false
							if (!message.includes("403")) {
								state.error = message
							}
						})
						return []
					})
					.finally(() => memberLoads.delete(cacheKey))

				memberLoads.set(cacheKey, load)
				return load
			}

			return {
				members: [],
				memberCache: {},
				activeMemberCacheKey: null,
				invites: [],
				myInvites: [],
				loading: false,
				error: null,

				fetchMembers: async (vaultId, serverUrl) => {
					await loadMembers(vaultId, serverUrl, true)
				},

				ensureMembers: (vaultId, serverUrl) => loadMembers(vaultId, serverUrl, false),

				updateMemberRole: async (vaultId, userId, role) => {
					try {
						const platform = getPlatform()
						await prepareMemberMutation()
						await platform.members.updateMemberRole(vaultId, userId, role)
						set((state) => {
							const member = state.members.find((m) => m.userId === userId)
							if (member) member.role = role
							if (state.activeMemberCacheKey) {
								const cachedMember = state.memberCache[state.activeMemberCacheKey]?.find(
									(candidate) => candidate.userId === userId,
								)
								if (cachedMember) cachedMember.role = role
							}
						})
					} catch (e) {
						set((state) => {
							state.error = String(e)
						})
					}
				},

				removeMember: async (vaultId, userId) => {
					try {
						const platform = getPlatform()
						await prepareMemberMutation()
						await platform.members.removeMember(vaultId, userId)
						set((state) => {
							state.members = state.members.filter((m) => m.userId !== userId)
							if (state.activeMemberCacheKey) {
								state.memberCache[state.activeMemberCacheKey] = state.memberCache[
									state.activeMemberCacheKey
								].filter((member) => member.userId !== userId)
							}
						})
					} catch (e) {
						set((state) => {
							state.error = String(e)
						})
					}
				},

				fetchInvites: async (vaultId) => {
					try {
						const platform = getPlatform()
						await syncAuthContext(await resolveServerUrl())
						const invites = await platform.members.listInvites(vaultId)
						set((state) => {
							state.invites = invites
						})
					} catch (e) {
						set((state) => {
							state.error = String(e)
						})
					}
				},

				createInvite: async (vaultId, inviteeEmail, role, encryptedVaultKey) => {
					try {
						const platform = getPlatform()
						await prepareMemberMutation()
						const invite = await platform.members.createInvite(
							vaultId,
							inviteeEmail,
							role,
							encryptedVaultKey,
						)
						set((state) => {
							state.invites.push(invite)
						})
					} catch (e) {
						set((state) => {
							state.error = String(e)
						})
						throw e
					}
				},

				deleteInvite: async (vaultId, inviteId) => {
					try {
						const platform = getPlatform()
						await prepareMemberMutation()
						await platform.members.deleteInvite(vaultId, inviteId)
						set((state) => {
							state.invites = state.invites.filter((i) => i.id !== inviteId)
						})
					} catch (e) {
						set((state) => {
							state.error = String(e)
						})
					}
				},

				fetchMyInvites: async () => {
					try {
						const platform = getPlatform()
						await syncAuthContext(await resolveServerUrl())
						const invites = await platform.members.myInvites()
						set((state) => {
							state.myInvites = invites
						})
					} catch (e) {
						set((state) => {
							state.error = String(e)
						})
					}
				},

				acceptInvite: async (inviteId) => {
					try {
						const platform = getPlatform()
						await prepareMemberMutation()
						const result = await platform.members.acceptInvite(inviteId)
						set((state) => {
							state.myInvites = state.myInvites.filter((i) => i.id !== inviteId)
						})
						return result
					} catch (e) {
						set((state) => {
							state.error = String(e)
						})
						throw e
					}
				},

				clearError: () =>
					set((state) => {
						state.error = null
					}),
			}
		}),
		{ name: "membersStore" },
	),
)
