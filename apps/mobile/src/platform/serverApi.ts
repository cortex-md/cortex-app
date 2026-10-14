import { useAuthStore } from "@cortex/core"
import { createServerApiServices } from "@cortex/sync-api"
import {
	accountKeyCrypto,
	configureSyncRuntime,
	createInviteKeyLink,
	storeInviteKey,
} from "@cortex/sync-engine"

import { getDeviceInfo } from "./device"
import { secrets } from "./keychain"
import { mobileSyncRuntime } from "./syncRuntime"

configureSyncRuntime(mobileSyncRuntime)

export const serverApi = createServerApiServices({
	secrets,
	getDeviceInfo,
	keyCrypto: accountKeyCrypto,
	onSessionExpired: () => {
		void useAuthStore.getState().logout()
	},
	createInviteKeyLink: async (vaultId) => createInviteKeyLink(secrets, vaultId),
	storeInviteKey: async (vaultId, encryptedVaultKey, linkKey) =>
		storeInviteKey(secrets, vaultId, encryptedVaultKey, linkKey),
})
