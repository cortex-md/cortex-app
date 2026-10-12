import type { Platform } from "@cortex/platform"
import { unsupportedPhase1 } from "./unsupported"

export const sharesApi = {
	list: () => unsupportedPhase1("shares.list"),
	publish: () => unsupportedPhase1("shares.publish"),
	updateExpiry: () => unsupportedPhase1("shares.updateExpiry"),
	revoke: () => unsupportedPhase1("shares.revoke"),
	open: () => unsupportedPhase1("shares.open"),
} satisfies Platform["shares"]
