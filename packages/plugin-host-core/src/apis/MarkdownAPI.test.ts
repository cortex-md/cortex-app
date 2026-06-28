import {
	getMarkdownInlineRegistrations,
	getMarkdownPreprocessors,
	getMarkdownProcessors,
	getMarkdownSemanticRegistrations,
	resolveCalloutType,
} from "@cortex/renderer"
import { beforeEach, describe, expect, it } from "vitest"
import { pluginStore } from "../pluginStore"
import { createMarkdownAPI } from "./MarkdownAPI"

beforeEach(() => {
	pluginStore.getState().reset()
	pluginStore.getState().registerPlugin({
		id: "markdown-test",
		name: "Markdown Test",
		version: "0.1.0",
		minAppVersion: "0.1.0",
		author: "Cortex",
		description: "Test plugin",
		icon: "file-text",
		main: "index.ts",
		capabilities: ["markdown:extensions"],
	})
})

describe("MarkdownAPI", () => {
	it("registers and disposes callout type overrides", () => {
		const api = createMarkdownAPI("markdown-test")
		const registration = api.registerCalloutType({
			type: "warning",
			label: "Attention",
			color: "#ffaa00",
		})

		expect(resolveCalloutType("warning")).toMatchObject({
			label: "Attention",
			color: "#ffaa00",
		})

		registration.dispose()
		expect(resolveCalloutType("warning").label).toBe("Warning")
		expect(resolveCalloutType("warning").color).toBeUndefined()
	})

	it("registers one inline rule for editor and renderer consumers", () => {
		const api = createMarkdownAPI("markdown-test")
		const registration = api.registerInline({
			id: "emoji",
			pattern: ":rocket:",
			replacement: { type: "text", content: "🚀" },
		})

		expect(getMarkdownInlineRegistrations()).toHaveLength(1)
		registration.dispose()
		expect(getMarkdownInlineRegistrations()).toHaveLength(0)
	})

	it("registers semantic transforms and targeted preprocessors/processors", () => {
		const api = createMarkdownAPI("markdown-test")
		const semantic = api.registerSemantic({
			id: "semantic",
			selector: { type: "text" },
			transform: ({ source }) => ({ type: "text", value: source.toUpperCase() }),
		})
		const preprocessor = api.registerPreprocessor({
			id: "reading-preprocessor",
			surfaces: ["reading-view"],
			preprocess: (markdown) => markdown.replace("before", "after"),
		})
		const processor = api.registerProcessor({
			id: "reading",
			phase: "rehype",
			surfaces: ["reading-view"],
			processor: () => undefined,
		})

		expect(getMarkdownSemanticRegistrations()).toHaveLength(1)
		expect(getMarkdownPreprocessors("reading-view")).toHaveLength(1)
		expect(getMarkdownProcessors("reading-view", "rehype")).toHaveLength(1)

		semantic.dispose()
		preprocessor.dispose()
		processor.dispose()
		expect(getMarkdownSemanticRegistrations()).toHaveLength(0)
		expect(getMarkdownPreprocessors()).toHaveLength(0)
		expect(getMarkdownProcessors()).toHaveLength(0)
	})

	it("rejects Live Preview as a processor or preprocessor surface", () => {
		const api = createMarkdownAPI("markdown-test")
		expect(() =>
			api.registerPreprocessor({
				id: "invalid-preprocessor",
				surfaces: ["live-preview" as never],
				preprocess: (markdown) => markdown,
			}),
		).toThrow("registerSemantic")
		expect(() =>
			api.registerProcessor({
				id: "invalid",
				phase: "rehype",
				surfaces: ["live-preview" as never],
				processor: () => undefined,
			}),
		).toThrow("registerSemantic")
	})

	it("rejects registrations without the markdown capability", () => {
		expect(() => createMarkdownAPI("missing").registerCalloutType({ type: "custom" })).toThrow(
			"markdown:extensions",
		)
	})
})
