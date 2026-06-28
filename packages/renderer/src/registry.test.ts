import { describe, expect, it, vi } from "vitest"
import {
	getMarkdownInlineRegistrations,
	getMarkdownRegistryVersion,
	registerMarkdownInline,
	subscribeMarkdownRegistry,
} from "./registry"

describe("Markdown registry transactions", () => {
	it("rejects invalid registrations without changing registry state", () => {
		const version = getMarkdownRegistryVersion()
		const count = getMarkdownInlineRegistrations().length

		expect(() =>
			registerMarkdownInline({
				id: "invalid-regex",
				pattern: "[",
				replacement: { type: "text", content: "invalid" },
			}),
		).toThrow()

		expect(getMarkdownRegistryVersion()).toBe(version)
		expect(getMarkdownInlineRegistrations()).toHaveLength(count)
	})

	it("namespaces active IDs and rejects duplicates transactionally", () => {
		const dispose = registerMarkdownInline(
			{
				id: "duplicate",
				pattern: "one",
				replacement: { type: "text", content: "two" },
			},
			"plugin",
		)

		expect(() =>
			registerMarkdownInline(
				{
					id: "duplicate",
					pattern: "three",
					replacement: { type: "text", content: "four" },
				},
				"plugin",
			),
		).toThrow("already active")

		dispose()
	})

	it("isolates listener failures from registry updates", () => {
		const listener = vi.fn()
		const unsubscribeFailure = subscribeMarkdownRegistry(() => {
			throw new Error("listener failed")
		})
		const unsubscribeListener = subscribeMarkdownRegistry(listener)

		const dispose = registerMarkdownInline({
			id: "listener-isolation",
			pattern: "one",
			replacement: { type: "text", content: "two" },
		})
		dispose()

		expect(listener).toHaveBeenCalledTimes(2)
		unsubscribeFailure()
		unsubscribeListener()
	})
})
