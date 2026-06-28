import { beforeEach, describe, expect, it, vi } from "vitest"

describe("theme manager bootstrap", () => {
	beforeEach(() => {
		vi.resetModules()
	})

	it("attaches the browser adapter when a bridge reads the manager before app startup", async () => {
		const { getThemeManager, initThemeManager, generateCSSString, generateCSSVariables } =
			await import("@cortex/theme")
		const adapter = {
			applyTheme: vi.fn(),
			injectCSS: vi.fn(),
			removeCSS: vi.fn(),
			applyOverrides: vi.fn(),
			clearOverrides: vi.fn(),
		}

		const earlyManager = getThemeManager()
		const initializedManager = initThemeManager("ink", adapter, {
			generateCSSString,
			generateCSSVariables,
		})

		expect(initializedManager).toBe(earlyManager)
		expect(adapter.injectCSS).toHaveBeenCalledWith(expect.stringContaining("--bg-primary"), "ink")
		expect(adapter.injectCSS).toHaveBeenCalledWith(expect.stringContaining("--bg-primary"), "paper")
		expect(adapter.applyTheme).toHaveBeenLastCalledWith("ink", "dark")
	})
})
