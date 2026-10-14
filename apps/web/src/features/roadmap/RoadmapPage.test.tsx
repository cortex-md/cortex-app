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
		expect(
			within(shipped).getAllByRole("link", { name: "Shipped in v0.1.0" })[0]?.getAttribute("href"),
		).toBe("https://github.com/cortex-md/cortex-app/releases/tag/v0.1.0")
		expect(screen.queryByText(/votes?/i)).toBeNull()
		expect(screen.getByRole("link", { name: "Suggest an idea" }).getAttribute("href")).toBe(
			"https://github.com/cortex-md/cortex-app/issues/new?template=feature_request.yml",
		)
	})
})
