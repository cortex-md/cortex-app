import { afterEach, describe, expect, it } from "vitest"
import { WebThemeAdapter } from "../../../features/themes/webThemeAdapter"

afterEach(() => {
	document.body.className = ""
	document.head.querySelectorAll("style[data-theme]").forEach((element) => {
		element.remove()
	})
	document.getElementById("cortex-theme-overrides")?.remove()
})

describe("WebThemeAdapter", () => {
	it("replaces hyphenated community theme classes without removing unrelated classes", () => {
		document.body.className = "app-ready theme-nord-deep-dark native-shell"

		new WebThemeAdapter().applyTheme("paper", "light")

		expect(document.body.classList.contains("theme-nord-deep-dark")).toBe(false)
		expect(document.body.classList.contains("theme-paper")).toBe(true)
		expect(document.body.classList.contains("app-ready")).toBe(true)
		expect(document.body.classList.contains("native-shell")).toBe(true)
		expect(document.body.dataset.themeScheme).toBe("light")
	})

	it("clears the override style tag when no explicit overrides remain", () => {
		const adapter = new WebThemeAdapter()

		adapter.applyOverrides({ "--font-ui": "Inter" })

		const overrideStyle = document.getElementById("cortex-theme-overrides")
		expect(overrideStyle).not.toBeNull()
		expect(overrideStyle?.textContent).toContain("!important")

		adapter.applyOverrides({})

		expect(document.getElementById("cortex-theme-overrides")).toBeNull()
	})
})
