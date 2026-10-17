import type { Platform } from "@cortex/platform"

import { unsupportedPhase1 } from "./unsupported"

export const windowApi = {
	closeCurrent: () => unsupportedPhase1("window.closeCurrent"),
	focusMain: () => unsupportedPhase1("window.focusMain"),
	restartApp: () => unsupportedPhase1("window.restartApp"),
	setColorScheme: async () => {},
	openVaultWindow: () => unsupportedPhase1("window.openVaultWindow"),
	openNewWindow: () => unsupportedPhase1("window.openNewWindow"),
	claimVault: async () => "claimed" as const,
	releaseVault: async () => {},
	markReady: async () => {},
	claimOnce: async () => true,
} satisfies Platform["window"]
