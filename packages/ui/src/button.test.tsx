/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Button } from "./button"

describe("Button", () => {
	it("defaults to a non-submit button", () => {
		render(<Button>Save</Button>)

		expect(screen.getByRole("button", { name: "Save" }).getAttribute("type")).toBe("button")
	})

	it("preserves explicit button types", () => {
		render(<Button type="submit">Submit</Button>)

		expect(screen.getByRole("button", { name: "Submit" }).getAttribute("type")).toBe("submit")
	})

	it("exposes stable button hooks and variable-backed control classes", () => {
		render(<Button>Create</Button>)

		const button = screen.getByRole("button", { name: "Create" })

		expect(button.getAttribute("data-slot")).toBe("button")
		expect(button.getAttribute("data-variant")).toBe("default")
		expect(button.getAttribute("data-size")).toBe("default")
		expect(button.className).toContain("rounded-[var(--control-pill-radius,999px)]")
		expect(button.className).toContain("text-[var(--control-font-size,13px)]")
		expect(button.className).toContain("h-[var(--button-height-md,var(--control-height-md,28px))]")
	})
})
