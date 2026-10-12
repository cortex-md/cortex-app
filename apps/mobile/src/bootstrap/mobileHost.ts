import { initializeCoreProperties } from "@cortex/core"
import { initPlatform } from "@cortex/platform"

import { registerMobileAppCommands } from "@/bootstrap/appCommands"
import { installMobileCrypto } from "@/bootstrap/crypto"
import { registerMobileMarketplace } from "@/bootstrap/marketplace"
import { expoPlatform } from "@/platform/expo-platform"

let initialized = false

export function initializeMobileHost(): void {
	if (initialized) return
	initialized = true
	installMobileCrypto()
	initPlatform(expoPlatform)
	initializeCoreProperties({ createId: () => crypto.randomUUID(), deviceType: "mobile" })
	registerMobileAppCommands()
	registerMobileMarketplace()
}
