import type { PropertiesRuntime } from "./types"

let propertiesRuntime: PropertiesRuntime | null = null

export function initializeProperties(runtime: PropertiesRuntime): void {
	propertiesRuntime = runtime
}

export function getPropertiesRuntime(): PropertiesRuntime {
	if (!propertiesRuntime) {
		throw new Error("Properties runtime not initialized. Call initializeProperties() first.")
	}
	return propertiesRuntime
}

export function getOptionalPropertiesRuntime(): PropertiesRuntime | null {
	return propertiesRuntime
}

export function resetPropertiesRuntime(): void {
	propertiesRuntime = null
}
