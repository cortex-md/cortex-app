import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RoadmapPage } from "./RoadmapPage"

describe("RoadmapPage", () => {
	it("renders roadmap status from existing product lists", () => {
		render(<RoadmapPage />)

		expect(
			screen.getByRole("heading", {
				level: 1,
				name: /What has shipped, what is in motion, and what is next/i,
			}),
		).toBeTruthy()
		const shipped = screen.getByRole("region", { name: "Shipped" })
		const inProgress = screen.getByRole("region", { name: "In progress" })
		const planned = screen.getByRole("region", { name: "Planned" })

		expect(within(shipped).getByText("Local Markdown vaults")).toBeTruthy()
		expect(within(shipped).getByText(/plain Markdown files as the source of truth/i)).toBeTruthy()
		expect(within(inProgress).getByText("Cortex Sync")).toBeTruthy()
		expect(within(inProgress).getByText("Stable Plugin API")).toBeTruthy()
		expect(within(inProgress).getByText(/encrypted blob storage/i)).toBeTruthy()
		expect(within(planned).getByText("Mobile apps")).toBeTruthy()
		expect(within(planned).getByText("Public notes")).toBeTruthy()
		expect(screen.getByRole("navigation", { name: "Site navigation" })).toBeTruthy()
		expect(screen.getByRole("button", { name: /Resources/i })).toBeTruthy()
		expect(screen.getByRole("link", { name: "Changelog" }).getAttribute("href")).toBe("/changelog")
		expect(screen.getByRole("link", { name: "Roadmap" }).getAttribute("href")).toBe("/roadmap")
	})
})
