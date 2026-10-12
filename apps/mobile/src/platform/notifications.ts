import type { Platform } from "@cortex/platform"

export const notificationsApi = {
	getCapabilities: () => ({
		actions: false,
		icons: false,
		sounds: false,
		supported: false,
	}),
	getPermission: async () => "unsupported",
	requestPermission: async () => "unsupported",
	send: async () => ({ delivered: false, reason: "unsupported" }),
} satisfies Platform["notifications"]
