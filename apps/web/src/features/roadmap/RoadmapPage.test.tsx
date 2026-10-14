import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { RoadmapItem } from "../../content/roadmap"
import { RoadmapPage } from "./RoadmapPage"

function issue(
	overrides: Partial<RoadmapItem> & Pick<RoadmapItem, "number" | "title">,
): RoadmapItem {
	return {
		description: "",
		url: `https://github.com/cortex-md/cortex-app/issues/${overrides.number}`,
		status: "planned",
		area: null,
		release: null,
		votes: 0,
		comments: 0,
		createdAt: "2026-09-01T00:00:00Z",
		closedAt: null,
		...overrides,
	}
}

describe("RoadmapPage", () => {
	it("renders roadmap status from GitHub issues", () => {
		render(
			<RoadmapPage
				roadmap={{
					status: "ok",
					items: [
						issue({
							number: 1,
							title: "Local Markdown vaults",
							description: "Plain Markdown files as the source of truth.",
							status: "shipped",
							area: "Workspace",
							release: "v0.1.0",
							closedAt: "2026-09-10T00:00:00Z",
						}),
						issue({
							number: 2,
							title: "Cortex Sync",
							status: "in-progress",
							area: "Sync",
							votes: 3,
						}),
						issue({ number: 3, title: "Public notes", area: "Sharing", votes: 1 }),
						issue({ number: 4, title: "Mobile apps", area: "Clients", votes: 9 }),
					],
				}}
			/>,
		)

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
		expect(within(shipped).getByText(/source of truth/i)).toBeTruthy()
		expect(within(inProgress).getByText("Cortex Sync")).toBeTruthy()
		expect(
			within(planned)
				.getAllByRole("heading", { level: 3 })
				.map((heading) => heading.textContent),
		).toEqual(["Mobile apps", "Public notes"])
		expect(
			within(shipped).getByRole("link", { name: "Shipped in v0.1.0" }).getAttribute("href"),
		).toBe("https://github.com/cortex-md/cortex-app/releases/tag/v0.1.0")
		expect(
			within(inProgress)
				.getByRole("link", { name: "3 votes. Vote on GitHub" })
				.getAttribute("href"),
		).toBe("https://github.com/cortex-md/cortex-app/issues/2")
		expect(screen.getByRole("link", { name: "Suggest an idea" }).getAttribute("href")).toBe(
			"https://github.com/cortex-md/cortex-app/issues/new?template=feature_request.yml",
		)
	})
})
