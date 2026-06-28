import { registerPropertyType } from "@cortex/properties"
import type { Disposable, PluginAPI } from "@cortex.md/api"
import { requirePluginCapability } from "../manifestCapabilities"

const pluginTypeDisposers = new Map<string, Set<() => void>>()

function requirePropertiesCapability(pluginId: string): void {
	requirePluginCapability(pluginId, "properties:types")
}

export function createPropertiesAPI(pluginId: string): PluginAPI["properties"] {
	return {
		registerType(registration): Disposable {
			requirePropertiesCapability(pluginId)
			const type = `${pluginId}:${registration.type.trim()}`
			const disposeRegistration = registerPropertyType({
				...registration,
				type,
			})
			let disposers = pluginTypeDisposers.get(pluginId)
			if (!disposers) {
				disposers = new Set()
				pluginTypeDisposers.set(pluginId, disposers)
			}
			disposers.add(disposeRegistration)
			return {
				dispose() {
					disposeRegistration()
					disposers?.delete(disposeRegistration)
					if (disposers?.size === 0) pluginTypeDisposers.delete(pluginId)
				},
			}
		},
	}
}

export function disposePluginPropertyTypes(pluginId: string): void {
	const disposers = pluginTypeDisposers.get(pluginId)
	if (!disposers) return
	for (const dispose of disposers) dispose()
	pluginTypeDisposers.delete(pluginId)
}
