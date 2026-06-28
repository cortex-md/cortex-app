import type {
	AcceptInviteResult,
	Members as IMembers,
	VaultInvite,
	VaultMember,
} from "@cortex/platform"
import { invoke } from "@tauri-apps/api/core"

export class Members implements IMembers {
	async listMembers(vaultId: string): Promise<VaultMember[]> {
		return await invoke<VaultMember[]>("vault_members_list", { vaultId })
	}

	async updateMemberRole(vaultId: string, userId: string, role: string): Promise<void> {
		await invoke<void>("vault_member_update_role", { vaultId, userId, role })
	}

	async removeMember(vaultId: string, userId: string): Promise<void> {
		await invoke<void>("vault_member_remove", { vaultId, userId })
	}

	async createInvite(
		vaultId: string,
		inviteeEmail: string,
		role: string,
		encryptedVaultKey: string,
	): Promise<VaultInvite> {
		return await invoke<VaultInvite>("vault_invite_create", {
			vaultId,
			inviteeEmail,
			role,
			encryptedVaultKey,
		})
	}

	async listInvites(vaultId: string): Promise<VaultInvite[]> {
		return await invoke<VaultInvite[]>("vault_invites_list", { vaultId })
	}

	async deleteInvite(vaultId: string, inviteId: string): Promise<void> {
		await invoke<void>("vault_invite_delete", { vaultId, inviteId })
	}

	async myInvites(): Promise<VaultInvite[]> {
		return await invoke<VaultInvite[]>("vault_my_invites")
	}

	async acceptInvite(inviteId: string): Promise<AcceptInviteResult> {
		return await invoke<AcceptInviteResult>("vault_invite_accept", { inviteId })
	}
}
