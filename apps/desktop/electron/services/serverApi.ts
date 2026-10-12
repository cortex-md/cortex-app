import { createServerApiServices, type SecretStore } from "@cortex/sync-api"
import { createInviteKeyLink, nodeAccountKeyCrypto, storeInviteKey } from "@cortex/sync-engine"
import { emitToRenderer } from "../events"
import { getDeviceInfo, resetDeviceId } from "./device"
import { delete as deleteSecret, get as getSecret, set as setSecret } from "./keychain"

export const secrets: SecretStore = { get: getSecret, set: setSecret, delete: deleteSecret }

export const serverApi = createServerApiServices({
	secrets,
	getDeviceInfo,
	resetDeviceId,
	keyCrypto: nodeAccountKeyCrypto,
	onSessionExpired: () => emitToRenderer("auth-session-expired"),
	createInviteKeyLink: async (vaultId) => createInviteKeyLink(secrets, vaultId),
	storeInviteKey: async (vaultId, encryptedVaultKey, linkKey) =>
		storeInviteKey(secrets, vaultId, encryptedVaultKey, linkKey),
})
