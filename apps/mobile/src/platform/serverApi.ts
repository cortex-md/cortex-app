import { useAuthStore } from "@cortex/core"
import { createServerApiServices } from "@cortex/sync-api"

import { getDeviceInfo } from "./device"
import { secrets } from "./keychain"

export const serverApi = createServerApiServices({
	secrets,
	getDeviceInfo,
	onSessionExpired: () => {
		void useAuthStore.getState().logout()
	},
})
