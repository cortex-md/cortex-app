import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeToggle } from "./ThemeToggle"
import { siteThemeStorageKey } from "./theme"

function mockMatchMedia(matches: boolean) {
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			matches,
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	})
}

describe("ThemeToggle", () => {
	beforeEach(() => {
		window.localStorage.clear()
		document.documentElement.removeAttribute("data-theme")
		document.documentElement.style.colorScheme = ""
		document.head.innerHTML = '<meta name="theme-color" content="#fbfbfc">'
		mockMatchMedia(false)
	})

	it("initializes from the system theme when nothing is stored", async () => {
		mockMatchMedia(true)
		render(<ThemeToggle />)

		await waitFor(() => {
			expect(document.documentElement.dataset.theme).toBe("dark")
		})
		expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeTruthy()
		expect(window.localStorage.getItem(siteThemeStorageKey)).toBeNull()
	})

	it("persists manual theme changes", async () => {
		render(<ThemeToggle />)

		await waitFor(() => {
			expect(document.documentElement.dataset.theme).toBe("light")
		})

		fireEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }))

		expect(document.documentElement.dataset.theme).toBe("dark")
		expect(document.documentElement.style.colorScheme).toBe("dark")
		expect(window.localStorage.getItem(siteThemeStorageKey)).toBe("dark")
		expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(
			"#10100d",
		)
	})
})
