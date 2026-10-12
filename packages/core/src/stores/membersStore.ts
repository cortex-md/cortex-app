import type {
	AcceptInviteResult,
	AccessRule,
	GroupUpdate,
	InviteOptions,
	InvitePreview,
	MemberDevice,
	RemoteVaultInfo,
	VaultGroup,
	VaultInvite,
	VaultMember,
	VaultPresencePeer,
} from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { requiresCloudEntitlement, resolveSyncServerUrl } from "../sync/serverConfig"
import { useAccessStore } from "./accessStore"
import { useAuthStore } from "./authStore"
import { useRemoteVaultStore } from "./remoteVaultStore"
import { useSubscriptionStore } from "./subscriptionStore"

export interface MembersState {
	members: VaultMember[]
	memberCache: Record<string, VaultMember[]>
	activeMemberCacheKey: string | null
	invites: VaultInvite[]
	myInvites: VaultInvite[]
	groups: VaultGroup[]
	accessRules: AccessRule[]
	presence: VaultPresencePeer[]
	memberDevices: MemberDevice[]
	overviewVault: RemoteVaultInfo | null
	overviewVaultId: string | null
	myRole: string | null
	loading: boolean
	error: string | null

	fetchOverview: (vaultId: string) => Promise<void>
	createGroup: (vaultId: string, name: string, memberIds: string[]) => Promise<VaultGroup>
	updateGroup: (vaultId: string, groupId: string, update: GroupUpdate) => Promise<VaultGroup>
	deleteGroup: (vaultId: string, groupId: string) => Promise<void>
	setAccessRule: (vaultId: string, rule: AccessRule) => Promise<AccessRule | null>
	previewInvite: (token: string) => Promise<InvitePreview>
	acceptInviteLink: (token: string, linkKey: string | null) => Promise<AcceptInviteResult>

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
		options?: InviteOptions,
	) => Promise<VaultInvite>
	deleteInvite: (vaultId: string, inviteId: string) => Promise<void>
	fetchMyInvites: () => Promise<void>
	acceptInvite: (inviteId: string) => Promise<AcceptInviteResult>
	clearError: () => void
}

const memberLoads = new Map<string, Promise<VaultMember[]>>()

async function resolveServerUrl(serverUrl?: string): Promise<string> {
	if (serverUrl) return serverUrl.trim().replace(/\/+$/, "")
	return resolveSyncServerUrl(useRemoteVaultStore.getState().syncConfig)
}

async function syncAuthContext(serverUrl: string): Promise<void> {
	await useAuthStore.getState().checkAuth(serverUrl || undefined)
}

async function ensureMemberMutationAllowed(): Promise<void> {
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
				groups: [],
				accessRules: [],
				presence: [],
				memberDevices: [],
				overviewVault: null,
				overviewVaultId: null,
				myRole: null,
				loading: false,
				error: null,

				fetchOverview: async (vaultId) => {
					const resolvedServerUrl = await resolveServerUrl()
					const cacheKey = `${resolvedServerUrl}:${vaultId}`
					set((state) => {
						state.loading = true
						state.error = null
						if (state.activeMemberCacheKey !== cacheKey) {
							state.members = []
							state.invites = []
							state.groups = []
							state.accessRules = []
							state.presence = []
							state.myRole = null
							state.activeMemberCacheKey = cacheKey
						}
					})
					try {
						await syncAuthContext(resolvedServerUrl)
						const overview = await getPlatform().members.getVaultOverview(vaultId)
						set((state) => {
							state.members = overview.members
							state.memberCache[cacheKey] = overview.members
							state.invites = overview.invites
							state.groups = overview.groups
							state.accessRules = overview.accessRules
							state.presence = overview.presence
							state.memberDevices = overview.devices
							state.overviewVault = overview.vault
							state.overviewVaultId = vaultId
							state.myRole = overview.myRole
							state.loading = false
						})
					} catch (e) {
						set((state) => {
							state.loading = false
							state.error = String(e)
						})
					}
				},

				createGroup: async (vaultId, name, memberIds) => {
					try {
						await prepareMemberMutation()
						const group = await getPlatform().members.createGroup(vaultId, name, memberIds)
						set((state) => {
							state.groups.push(group)
						})
						return group
					} catch (e) {
						set((state) => {
							state.error = String(e)
						})
						throw e
					}
				},

				updateGroup: async (vaultId, groupId, update) => {
					try {
						await prepareMemberMutation()
						const group = await getPlatform().members.updateGroup(vaultId, groupId, update)
						set((state) => {
							const index = state.groups.findIndex((candidate) => candidate.id === groupId)
							if (index === -1) state.groups.push(group)
							else state.groups[index] = group
						})
						return group
					} catch (e) {
						set((state) => {
							state.error = String(e)
						})
						throw e
					}
				},

				deleteGroup: async (vaultId, groupId) => {
					try {
						await prepareMemberMutation()
						await getPlatform().members.deleteGroup(vaultId, groupId)
						set((state) => {
							state.groups = state.groups.filter((group) => group.id !== groupId)
							for (const rule of state.accessRules) {
								rule.entries = rule.entries.filter(
									(entry) => entry.principalType !== "group" || entry.principalId !== groupId,
								)
							}
						})
					} catch (e) {
						set((state) => {
							state.error = String(e)
						})
						throw e
					}
				},

				setAccessRule: async (vaultId, rule) => {
					try {
						await prepareMemberMutation()
						const saved = await getPlatform().members.setAccessRule(vaultId, rule)
						set((state) => {
							const remaining = state.accessRules.filter(
								(candidate) => candidate.path !== rule.path,
							)
							state.accessRules = saved ? [...remaining, saved] : remaining
						})
						return saved
					} catch (e) {
						set((state) => {
							state.error = String(e)
						})
						throw e
					}
				},

				previewInvite: async (token) => {
					await syncAuthContext(await resolveServerUrl())
					return await getPlatform().members.previewInvite(token)
				},

				acceptInviteLink: async (token, linkKey) => {
					await prepareMemberMutation()
					return await getPlatform().members.acceptInviteLink(token, linkKey)
				},

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
							for (const group of state.groups) {
								group.memberIds = group.memberIds.filter((memberId) => memberId !== userId)
							}
							for (const rule of state.accessRules) {
								rule.entries = rule.entries.filter(
									(entry) => entry.principalType !== "user" || entry.principalId !== userId,
								)
							}
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

				createInvite: async (vaultId, inviteeEmail, role, encryptedVaultKey, options) => {
					try {
						const platform = getPlatform()
						await prepareMemberMutation()
						const invite = await platform.members.createInvite(
							vaultId,
							inviteeEmail,
							role,
							encryptedVaultKey,
							options,
						)
						set((state) => {
							state.invites.push(invite)
						})
						return invite
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

useAccessStore.subscribe((state, previous) => {
	if (state.access === previous.access || !state.access) return
	const { overviewVaultId, fetchOverview } = useMembersStore.getState()
	if (overviewVaultId) void fetchOverview(overviewVaultId)
})
