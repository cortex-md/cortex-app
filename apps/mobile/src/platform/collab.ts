import type { Platform } from "@cortex/platform"
import { unsupportedPhase1 } from "./unsupported"

export const collabApi = {
	availability: async () => "unsupported",
	open: () => unsupportedPhase1("collab.open"),
	setFileSyncRole: async () => {},
} satisfies Platform["collab"]
