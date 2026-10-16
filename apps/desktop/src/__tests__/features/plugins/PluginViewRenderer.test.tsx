// @vitest-environment jsdom

import type { RegisteredView } from "@cortex/plugin-host-core"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { PluginViewRenderer } from "../../../features/plugins/rendering/PluginViewRenderer"

beforeAll(() => {
	globalThis.ResizeObserver ??= class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
})

afterEach(cleanup)

describe("PluginViewRenderer", () => {
	it("renders v1 utility nodes without exposing host components to plugins", () => {
		const registration: RegisteredView = {
			owner: "test",
			key: "test:view",
			initialState: {},
			id: "utility-nodes",
			label: "Utility nodes",
			icon: "panel-top",
			location: "tab",
			render: () => [
				{
					type: "alert",
					tone: "warning",
					title: "Needs review",
					message: "This plugin action needs confirmation.",
					icon: "triangle-alert",
				},
				{
					type: "setting-row",
					label: "Enable automation",
					description: "Runs when the vault changes.",
					children: { type: "toggle", label: "Enable automation", checked: true },
				},
				{
					type: "input",
					inputType: "search",
					label: "Search notes",
					value: "",
				},
				{
					type: "item",
					title: "Daily note",
					description: "Open today's note",
					icon: "calendar",
					badge: "new",
				},
				{
					type: "tabs",
					value: "summary",
					tabs: [
						{
							value: "summary",
							label: "Summary",
							children: { type: "text", value: "Summary content" },
						},
						{
							value: "details",
							label: "Details",
							children: { type: "text", value: "Details content" },
						},
					],
				},
				{
					type: "table",
					columns: [
						{ key: "name", label: "Name" },
						{ key: "count", label: "Count", align: "end" },
					],
					rows: [{ cells: { name: "Backlinks", count: 12 } }],
				},
				{ type: "progress", label: "Loading metadata" },
			],
		}

		render(<PluginViewRenderer registration={registration} />)

		expect(screen.getByText("Needs review")).toBeTruthy()
		expect(screen.getAllByText("Enable automation").length).toBeGreaterThan(0)
		expect(screen.getByLabelText("Search notes")).toBeTruthy()
		expect(screen.getByText("Daily note")).toBeTruthy()
		expect(screen.getByRole("tab", { name: "Summary" })).toBeTruthy()
		expect(screen.getByText("Backlinks")).toBeTruthy()
		expect(screen.getByText("Loading metadata")).toBeTruthy()
	})
})
