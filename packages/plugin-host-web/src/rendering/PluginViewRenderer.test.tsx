// @vitest-environment jsdom

import type { ViewRegistration } from "@cortex.md/api"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { PluginViewRenderer } from "./PluginViewRenderer"

beforeAll(() => {
	globalThis.ResizeObserver ??= class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
})

afterEach(cleanup)

describe("PluginViewRenderer", () => {
	it("renders nested descriptor children through the recursive component boundary", () => {
		const registration: ViewRegistration = {
			id: "nested-view",
			label: "Nested view",
			icon: "layers",
			location: "sidebar-left",
			render: () => ({
				type: "stack",
				gap: "md",
				children: [
					{ type: "heading", value: "Inbox" },
					{
						type: "row",
						children: {
							type: "badge",
							value: "3",
						},
					},
					{
						type: "list",
						children: [
							{
								type: "list-item",
								children: { type: "text", value: "First note" },
							},
						],
					},
				],
			}),
		}

		const html = renderToStaticMarkup(<PluginViewRenderer registration={registration} />)

		expect(html).toContain("Inbox")
		expect(html).toContain("3")
		expect(html).toContain("First note")
		expect(html).toContain("gap-3")
	})

	it("resets internal state when the view registration changes", async () => {
		const createRegistration = (initialCount: number): ViewRegistration => ({
			id: "counter",
			label: "Counter",
			icon: "plus",
			location: "sidebar-left",
			initialState: { count: initialCount },
			reduce: (state, action) =>
				action === "increment" ? { count: Number(state.count) + 1 } : state,
			render: ({ state }) => ({
				type: "button",
				label: `count:${state.count}`,
				action: "increment",
			}),
		})

		const { rerender } = render(<PluginViewRenderer registration={createRegistration(0)} />)
		await userEvent.click(screen.getByRole("button", { name: "count:0" }))
		expect(screen.getByRole("button", { name: "count:1" })).toBeTruthy()

		rerender(<PluginViewRenderer registration={createRegistration(7)} />)

		expect(screen.getByRole("button", { name: "count:7" })).toBeTruthy()
	})

	it("labels host-rendered input and toggle controls", () => {
		const registration: ViewRegistration = {
			id: "controls",
			label: "Controls",
			icon: "settings",
			location: "sidebar-left",
			render: () => [
				{ type: "input", label: "Search notes", value: "" },
				{ type: "toggle", label: "Enable sync", checked: true },
				{ type: "slider", label: "Emoji size", value: 12, min: 8, max: 24 },
			],
		}

		render(<PluginViewRenderer registration={registration} />)

		expect(screen.getByLabelText("Search notes")).toBeTruthy()
		expect(screen.getByRole("switch", { name: "Enable sync" })).toBeTruthy()
		expect(screen.getByText("Emoji size")).toBeTruthy()
	})

	it("renders v1 utility nodes without exposing host components to plugins", () => {
		const registration: ViewRegistration = {
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

	it("renders item stacks inside scroll areas with desktop UI primitives", () => {
		const registration: ViewRegistration = {
			id: "item-scroll",
			label: "Item scroll",
			icon: "list",
			location: "sidebar-left",
			render: () => ({
				type: "scroll-area",
				size: "md",
				children: {
					type: "stack",
					gap: "xs",
					children: [
						{ type: "item", title: "Rocket", description: ":rocket:" },
						{ type: "item", title: "Fire", description: ":fire:" },
					],
				},
			}),
		}

		const html = renderToStaticMarkup(<PluginViewRenderer registration={registration} />)

		expect(html).toContain('data-slot="scroll-area"')
		expect(html).toContain('data-slot="item-group"')
		expect(html).toContain("h-56")
		expect(html).toContain("gap-1")
	})
})
