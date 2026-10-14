import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { downloadPlatforms, pricingFaq } from "../../content/landing"
import { ProductMedia } from "../site/ProductMedia"
import { LandingPage } from "./LandingPage"

function renderLanding() {
	return render(<LandingPage />)
}

describe("LandingPage", () => {
	it("renders the redesigned product narrative", () => {
		renderLanding()

		expect(screen.getByRole("heading", { level: 1, name: /Notes you own\./ })).toBeTruthy()
		for (const name of [
			/Organize without leaving/,
			/Nothing you write/,
			/Write together,/,
			/Made for/,
			/One vault,/,
			/Free to write\./,
			/Recently shipped/,
			/Open a folder\./,
		]) {
			expect(screen.getByRole("heading", { level: 2, name })).toBeTruthy()
		}
		expect(document.getElementById("features")).toBeTruthy()
	})

	it("places paid Sync after the FAQ and Downloads as the final landing section", () => {
		const { container } = renderLanding()
		const sectionIds = Array.from(container.querySelectorAll("section[id]")).map(
			(section) => section.id,
		)

		expect(sectionIds.indexOf("pricing")).toBeGreaterThan(sectionIds.indexOf("products"))
		expect(sectionIds.at(-1)).toBe("download")
		expect(screen.getByText("Recommended")).toBeTruthy()
		expect(screen.getByRole("link", { name: "Start syncing" }).getAttribute("href")).toBe(
			"/billing",
		)
	})

	it("renders download platform cards with direct latest links by default", () => {
		renderLanding()
		const download = document.getElementById("download")
		if (!download) throw new Error("Missing download section")
		const scope = within(download)
		const expected = downloadPlatforms.map((platform) => {
			const option = platform.options.find((item) => "href" in item && item.href)
			return option && "href" in option ? option.href : null
		})

		expect(scope.getByRole("link", { name: "Download for macOS" }).getAttribute("href")).toBe(
			expected[0],
		)
		expect(scope.getByRole("link", { name: "Windows" }).getAttribute("href")).toBe(expected[1])
		expect(scope.getByRole("link", { name: "Linux" }).getAttribute("href")).toBe(expected[2])
	})

	it("uses the local FAQ accordion with smooth collapse animation", () => {
		renderLanding()
		const [first, second] = pricingFaq

		const firstTrigger = screen.getByRole("button", { name: first.question })
		const secondTrigger = screen.getByRole("button", { name: second.question })
		expect(firstTrigger.getAttribute("aria-expanded")).toBe("true")
		expect(secondTrigger.getAttribute("aria-expanded")).toBe("false")

		fireEvent.click(secondTrigger)
		expect(secondTrigger.getAttribute("aria-expanded")).toBe("true")
		expect(firstTrigger.getAttribute("aria-expanded")).toBe("false")

		const compare = screen.getByRole("button", { name: "Compare every feature" })
		fireEvent.click(compare)
		expect(screen.getByRole("table", { name: "Compare plans" })).toBeTruthy()
	})

	it("keeps every named media slot accessible", () => {
		const { container } = renderLanding()

		for (const image of Array.from(container.querySelectorAll("img"))) {
			expect(image.hasAttribute("alt")).toBe(true)
		}
		for (const figure of Array.from(container.querySelectorAll("figure"))) {
			expect(
				figure.getAttribute("aria-label") || figure.querySelector("figcaption")?.textContent,
			).toBeTruthy()
		}
		expect(
			container.querySelector('img[loading="eager"][src*="/media/paintings/dawn"]'),
		).toBeTruthy()
		expect(container.querySelectorAll('img[loading="eager"]').length).toBe(1)
		expect(screen.queryByText(/Placeholder/i)).toBeNull()
	})
})

describe("ProductMedia", () => {
	it("loads the hero eagerly and reserves image dimensions", () => {
		const { container } = render(
			<ProductMedia
				label="Hero"
				description="Primary product view"
				alt="Primary product view"
				src="/media/cortex-workspace.svg"
				webpSrc="/media/cortex-workspace.webp"
				priority
			/>,
		)

		const image = screen.getByAltText("Primary product view")
		const webpSource = container.querySelector('source[type="image/webp"]')
		expect(webpSource?.getAttribute("srcset")).toBe("/media/cortex-workspace.webp")
		expect(image.getAttribute("loading")).toBe("eager")
		expect(image.getAttribute("fetchpriority")).toBe("high")
		expect(image.getAttribute("width")).toBe("1600")
		expect(image.getAttribute("height")).toBe("1000")
		expect(screen.getByText("Hero. Primary product view")).toBeTruthy()
	})
})
