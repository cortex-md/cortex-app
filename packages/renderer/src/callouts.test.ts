import { describe, expect, it } from "vitest"
import { getCalloutTypes, parseCallout, registerCalloutType, resolveCalloutType } from "./callouts"

describe("callout registry", () => {
	it("resolves built-in aliases", () => {
		expect(resolveCalloutType("caution").type).toBe("warning")
		expect(resolveCalloutType("tldr").type).toBe("abstract")
	})

	it("stacks overrides and restores the previous definition on dispose", () => {
		const disposeColor = registerCalloutType({
			type: "warning",
			color: "#ff0000",
			aliases: ["heads-up"],
		})
		const disposeLabel = registerCalloutType({
			type: "warning",
			label: "Heads up",
		})

		expect(resolveCalloutType("heads-up")).toMatchObject({
			type: "warning",
			label: "Heads up",
			color: "#ff0000",
		})

		disposeLabel()
		expect(resolveCalloutType("warning")).toMatchObject({
			label: "Warning",
			color: "#ff0000",
		})

		disposeColor()
		expect(resolveCalloutType("warning").label).toBe("Warning")
		expect(resolveCalloutType("warning").color).toBeUndefined()
	})

	it("registers custom types without removing built-in aliases", () => {
		const dispose = registerCalloutType({
			type: "release",
			label: "Release",
			aliases: ["ship"],
		})

		expect(resolveCalloutType("ship").type).toBe("release")
		expect(getCalloutTypes().some((callout) => callout.type === "release")).toBe(true)

		dispose()
	})

	it("falls unknown types back to note styling while preserving their name", () => {
		expect(resolveCalloutType("custom-alert")).toMatchObject({
			type: "custom-alert",
			fallbackType: "note",
			label: "Custom Alert",
		})
	})
})

describe("parseCallout", () => {
	it("parses titles, expanded state, and quoted body content", () => {
		expect(parseCallout("> [!warning]+ Custom title\n>\n> Body\n> **bold**")).toEqual({
			type: "warning",
			title: "Custom title",
			fold: "expanded",
			bodyMarkdown: "\nBody\n**bold**",
		})
	})

	it("parses collapsed callouts", () => {
		expect(parseCallout("> [!note]-\n> Hidden")).toMatchObject({
			type: "note",
			fold: "collapsed",
			bodyMarkdown: "Hidden",
		})
	})
})
