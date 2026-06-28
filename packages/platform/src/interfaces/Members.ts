export interface VaultMember {
	vaultId: string
	userId: string
	email: string
	displayName: string
	role: string
	joinedAt: string
}

export interface VaultInvite {
	id: string
	vaultId: string
	vaultName: string
	inviterId: string
	inviteeEmail: string
	role: string
	encryptedVaultKey: string | null
	accepted: boolean
	expiresAt: string
	createdAt: string
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

export interface Members {
	listMembers(vaultId: string): Promise<VaultMember[]>
	updateMemberRole(vaultId: string, userId: string, role: string): Promise<void>
	removeMember(vaultId: string, userId: string): Promise<void>
	createInvite(
		vaultId: string,
		inviteeEmail: string,
		role: string,
		encryptedVaultKey: string,
	): Promise<VaultInvite>
	listInvites(vaultId: string): Promise<VaultInvite[]>
	deleteInvite(vaultId: string, inviteId: string): Promise<void>
	myInvites(): Promise<VaultInvite[]>
	acceptInvite(inviteId: string): Promise<AcceptInviteResult>
}
