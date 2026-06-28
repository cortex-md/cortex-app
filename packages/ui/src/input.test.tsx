/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Input } from "./input"

describe("Input", () => {
	it("exposes stable input hooks and variable-backed control classes", () => {
		render(<Input aria-label="Title" />)

		const input = screen.getByRole("textbox", { name: "Title" })

		expect(input.getAttribute("data-slot")).toBe("input")
		expect(input.getAttribute("data-size")).toBe("default")
		expect(input.className).toContain("rounded-[var(--control-radius,6px)]")
		expect(input.className).toContain("text-[var(--control-font-size,13px)]")
		expect(input.className).toContain("h-[var(--input-height-md,32px)]")
	})
})
