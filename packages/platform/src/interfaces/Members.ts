import type { RemoteVaultInfo } from "./RemoteVault"

export type VaultRole = "owner" | "admin" | "editor" | "viewer" | "guest"

export interface PathGrant {
	path: string
	canWrite: boolean
}

export interface VaultMember {
	vaultId: string
	userId: string
	email: string
	displayName: string
	avatarUrl: string | null
	hasKey: boolean
	publicKey: string | null
	role: string
	joinedAt: string
}

export type AccessLevel = "view" | "edit"
export type EffectiveAccessLevel = "none" | AccessLevel
export type AccessPrincipalType = "user" | "group"

export interface AccessEntry {
	principalType: AccessPrincipalType
	principalId: string
	level: AccessLevel
}

export interface AccessRule {
	path: string
	restricted: boolean
	entries: AccessEntry[]
}

export interface EffectiveAccessRule {
	path: string
	level: EffectiveAccessLevel
}

export interface EffectiveAccess {
	all: boolean
	base: EffectiveAccessLevel
	rules: EffectiveAccessRule[]
}

export interface VaultGroup {
	id: string
	name: string
	memberIds: string[]
	createdAt: string
}

export interface GroupUpdate {
	name?: string
	memberIds?: string[]
}

export interface VaultInvite {
	id: string
	vaultId: string
	vaultName: string
	inviterId: string
	inviterName: string | null
	inviteeEmail: string
	role: string
	grants: PathGrant[]
	encryptedVaultKey: string | null
	inviteUrl: string | null
	accepted: boolean
	expiresAt: string
	createdAt: string
}

export interface InviteOptions {
	grants?: PathGrant[]
}

export interface InvitePreview {
	vaultName: string
	inviterName: string
	role: string
	expiresAt: string
}

export interface AcceptInviteResult {
	id: string
	name: string
	description: string | null
	ownerId: string
	role: string
	createdAt: string
	updatedAt: string
}

export interface MemberDevice {
	id: string
	userId: string
	deviceName: string
	deviceType: string
	lastSeenAt: string
	syncedAt: string | null
}

export interface VaultPresencePeer {
	userId: string
	filePath: string
	canWrite: boolean
}

export interface VaultOverview {
	vault: RemoteVaultInfo
	myRole: string
	myAccess: EffectiveAccess
	members: VaultMember[]
	groups: VaultGroup[]
	accessRules: AccessRule[]
	invites: VaultInvite[]
	devices: MemberDevice[]
	presence: VaultPresencePeer[]
}

export interface Members {
	listMembers(vaultId: string): Promise<VaultMember[]>
	getVaultOverview(vaultId: string): Promise<VaultOverview>
	updateMemberRole(vaultId: string, userId: string, role: string): Promise<void>
	removeMember(vaultId: string, userId: string): Promise<void>
	listGroups(vaultId: string): Promise<VaultGroup[]>
	createGroup(vaultId: string, name: string, memberIds: string[]): Promise<VaultGroup>
	updateGroup(vaultId: string, groupId: string, update: GroupUpdate): Promise<VaultGroup>
	deleteGroup(vaultId: string, groupId: string): Promise<void>
	listAccessRules(vaultId: string): Promise<AccessRule[]>
	setAccessRule(vaultId: string, rule: AccessRule): Promise<AccessRule | null>
	createInvite(
		vaultId: string,
		inviteeEmail: string,
		role: string,
		encryptedVaultKey: string,
		options?: InviteOptions,
	): Promise<VaultInvite>
	listInvites(vaultId: string): Promise<VaultInvite[]>
	deleteInvite(vaultId: string, inviteId: string): Promise<void>
	myInvites(): Promise<VaultInvite[]>
	acceptInvite(inviteId: string): Promise<AcceptInviteResult>
	previewInvite(token: string): Promise<InvitePreview>
	acceptInviteLink(token: string, linkKey: string | null): Promise<AcceptInviteResult>
}
