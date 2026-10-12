import type { Platform } from "@cortex/platform"

import { ensureAppDirectory } from "./appStorage"

export const storageApi = {
	getAppDataDir: async () => ensureAppDirectory(),
} satisfies Platform["storage"]
