import * as crypto from "./crypto"
import * as http from "./httpClient"

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

interface MemberResponse {
	vault_id: string
	user_id: string
	email: string
	display_name: string
	role: string
	joined_at: string
}

interface InviteResponse {
	id: string
	vault_id: string
	vault_name: string
	inviter_id: string
	invitee_email: string
	role: string
	encrypted_vault_key?: string | null
	accepted: boolean
	expires_at: string
	created_at: string
}

interface AcceptResponse {
	id: string
	name: string
	description?: string | null
	owner_id: string
	role: string
	created_at: string
	updated_at: string
}

function mapMember(raw: MemberResponse): VaultMember {
	return {
		vaultId: raw.vault_id,
		userId: raw.user_id,
		email: raw.email,
		displayName: raw.display_name,
		role: raw.role,
		joinedAt: raw.joined_at,
	}
}

function mapInvite(raw: InviteResponse): VaultInvite {
	return {
		id: raw.id,
		vaultId: raw.vault_id,
		vaultName: raw.vault_name,
		inviterId: raw.inviter_id,
		inviteeEmail: raw.invitee_email,
		role: raw.role,
		encryptedVaultKey: raw.encrypted_vault_key ?? null,
		accepted: raw.accepted,
		expiresAt: raw.expires_at,
		createdAt: raw.created_at,
	}
}

export async function vaultMembersList(vaultId: string): Promise<VaultMember[]> {
	const response = await http.get(`/vaults/v1/${vaultId}/members/`)
	const items = await http.parseResponse<MemberResponse[]>(response)
	return items.map(mapMember)
}

export async function vaultMemberUpdateRole(
	vaultId: string,
	userId: string,
	role: string,
): Promise<void> {
	const response = await http.patchJson(`/vaults/v1/${vaultId}/members/${userId}`, { role })
	if (!response.ok) {
		const body = await response.text().catch(() => "")
		throw new Error(`HTTP ${response.status}: ${body}`)
	}
}

export async function vaultMemberRemove(vaultId: string, userId: string): Promise<void> {
	const response = await http.deleteRequest(`/vaults/v1/${vaultId}/members/${userId}`)
	if (!response.ok) {
		const body = await response.text().catch(() => "")
		throw new Error(`HTTP ${response.status}: ${body}`)
	}
}

export async function vaultInviteCreate(
	vaultId: string,
	inviteeEmail: string,
	role: string,
	encryptedVaultKey: string,
): Promise<VaultInvite> {
	let key = encryptedVaultKey
	if (!key) {
		const vek = crypto.loadVek(vaultId)
		if (!vek) {
			throw new Error("Vault encryption key not available. Unlock the vault first.")
		}
		key = vek.toString("base64")
	}
	const response = await http.postJson(`/vaults/v1/${vaultId}/invites/`, {
		invitee_email: inviteeEmail,
		role,
		encrypted_vault_key: key,
	})
	const item = await http.parseResponse<InviteResponse>(response)
	return mapInvite(item)
}

export async function vaultInvitesList(vaultId: string): Promise<VaultInvite[]> {
	const response = await http.get(`/vaults/v1/${vaultId}/invites/`)
	const items = await http.parseResponse<InviteResponse[]>(response)
	return items.map(mapInvite)
}

export async function vaultInviteDelete(vaultId: string, inviteId: string): Promise<void> {
	const response = await http.deleteRequest(`/vaults/v1/${vaultId}/invites/${inviteId}`)
	if (!response.ok) {
		const body = await response.text().catch(() => "")
		throw new Error(`HTTP ${response.status}: ${body}`)
	}
}

export async function vaultMyInvites(): Promise<VaultInvite[]> {
	const response = await http.get("/vaults/v1/invites")
	const items = await http.parseResponse<InviteResponse[]>(response)
	return items.map(mapInvite)
}

export async function vaultInviteAccept(inviteId: string): Promise<AcceptInviteResult> {
	const response = await http.postJson("/vaults/v1/invites/accept", { invite_id: inviteId })
	const item = await http.parseResponse<AcceptResponse>(response)
	return {
		id: item.id,
		name: item.name,
		description: item.description ?? null,
		ownerId: item.owner_id,
		role: item.role,
		createdAt: item.created_at,
		updatedAt: item.updated_at,
	}
}
