import { parseCommunityThemeManifest } from "@cortex/theme"
import { describe, expect, it } from "vitest"

function createManifest(partial: Record<string, unknown> = {}): string {
	return JSON.stringify({
		id: "quiet-theme",
		name: "quiet-theme",
		displayName: "Quiet Theme",
		author: "Cortex",
		version: "1.0.0",
		colorschemes: {
			dark: "dark.css",
			light: "light.css",
		},
		...partial,
	})
}

describe("community theme manifest", () => {
	it("accepts manifests without an API version", () => {
		expect(parseCommunityThemeManifest(createManifest())).toEqual({
			id: "quiet-theme",
			name: "quiet-theme",
			displayName: "Quiet Theme",
			author: "Cortex",
			version: "1.0.0",
			colorschemes: {
				dark: "dark.css",
				light: "light.css",
			},
		})
	})

	it("rejects invalid JSON and unsafe stylesheet paths", () => {
		expect(() => parseCommunityThemeManifest("{")).toThrow("Theme manifest is not valid JSON")
		expect(() =>
			parseCommunityThemeManifest(
				createManifest({
					colorschemes: {
						dark: "../dark.css",
						light: "light.css",
					},
				}),
			),
		).toThrow("Dark theme path must be relative and safe")
	})
})
