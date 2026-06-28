import { describe, expect, it } from "vitest"
import {
	pluginApiCapabilityRequirements,
	validatePluginManifestCapabilities,
} from "./manifestCapabilities"

describe("manifest capability requirements", () => {
	it("references only capabilities accepted by manifest validation", () => {
		const capabilities = Array.from(new Set(Object.values(pluginApiCapabilityRequirements).flat()))

		expect(() =>
			validatePluginManifestCapabilities({
				id: "matrix",
				name: "Matrix",
				version: "0.1.0",
				minAppVersion: "0.1.0",
				author: "Cortex",
				description: "Capability matrix",
				icon: "shield",
				main: "index.js",
				capabilities,
			}),
		).not.toThrow()
	})

	it("rejects legacy standalone hotkey capability", () => {
		expect(() =>
			validatePluginManifestCapabilities({
				id: "legacy-hotkeys",
				name: "Legacy Hotkeys",
				version: "0.1.0",
				minAppVersion: "0.1.0",
				author: "Cortex",
				description: "Capability matrix",
				icon: "keyboard",
				main: "index.js",
				capabilities: ["hotkeys" as never],
			}),
		).toThrow('Unknown plugin capability "hotkeys"')
	})
})
