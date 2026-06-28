import { generateCSSVariables, inkTheme, paperTheme, type Theme } from "@cortex/theme"
import { describe, expect, it } from "vitest"

describe("generateCSSVariables", () => {
	it("emits heading color variables", () => {
		const vars = generateCSSVariables(paperTheme)

		expect(vars["--h1-color"]).toBe("#be123c")
		expect(vars["--h2-color"]).toBe("#e11d48")
		expect(vars["--h3-color"]).toBe("#3f6fa8")
		expect(vars["--h4-color"]).toBe("#6b3a8a")
		expect(vars["--h5-color"]).toBe("#4d5060")
		expect(vars["--h6-color"]).toBe("#8b8f9d")
	})

	it("emits design-system primitive color aliases", () => {
		const vars = generateCSSVariables(paperTheme)
		const inkVars = generateCSSVariables(inkTheme)

		expect(vars["--stone-50"]).toBe("#fbfbfc")
		expect(vars["--mist-50"]).toBe("#fbfbfc")
		expect(vars["--ink-800"]).toBe("#11151b")
		expect(vars["--slate-800"]).toBe("#11151b")
		expect(inkVars["--ink-800"]).toBe("#1e1e1e")
		expect(inkVars["--slate-800"]).toBe("#1e1e1e")
		expect(vars["--amber-400"]).toBe("#fb7185")
		expect(vars["--rose-400"]).toBe("#fb7185")
		expect(vars["--amber-d-900"]).toBe("#3a101a")
		expect(vars["--rose-d-900"]).toBe("#3a101a")
	})

	it("emits brand aliases from the active accent tokens", () => {
		const vars = generateCSSVariables(paperTheme)

		expect(vars["--brand"]).toBe(paperTheme.tokens.semantic.accent.default)
		expect(vars["--brand-hover"]).toBe(paperTheme.tokens.semantic.accent.hover)
		expect(vars["--brand-active"]).toBe(paperTheme.tokens.semantic.accent.active)
		expect(vars["--brand-subtle"]).toBe(paperTheme.tokens.semantic.accent.subtle)
		expect(vars["--brand-border"]).toBe(paperTheme.tokens.semantic.accent.border)
		expect(vars["--brand-text"]).toBe(paperTheme.tokens.semantic.accent.text)
	})

	it("emits the public community theme variable families", () => {
		const vars = generateCSSVariables(paperTheme)

		const publicVariables = [
			"--font-ui",
			"--font-editor",
			"--ui-font-size",
			"--editor-font-size",
			"--ui-line-height",
			"--editor-line-height",
			"--radius",
			"--markdown-block-radius",
			"--tag-font-size",
			"--tag-font-weight",
			"--tag-border-radius",
			"--markdown-content-width",
			"--markdown-code-font-family",
			"--markdown-callout-padding-block",
			"--h1-font-size",
			"--h6-color",
		]

		for (const variable of publicVariables) {
			expect(vars).toHaveProperty(variable)
		}
	})

	it("emits the compact Minimal-inspired heading scale", () => {
		const vars = generateCSSVariables(paperTheme)

		expect(vars["--normal-weight"]).toBe("400")
		expect(vars["--heading-font-weight"]).toBe("600")
		expect(vars["--inline-title-margin-bottom"]).toBe("1rem")
		expect(vars["--h1-font-size"]).toBe("1.125em")
		expect(vars["--h2-font-size"]).toBe("1.05em")
		expect(vars["--h3-font-size"]).toBe("1em")
		expect(vars["--h4-font-size"]).toBe("0.9em")
		expect(vars["--h5-font-size"]).toBe("0.85em")
		expect(vars["--h6-font-size"]).toBe("0.85em")
	})

	it("falls back to syntax heading color for older themes", () => {
		const themeWithoutHeadingColors: Theme = {
			...paperTheme,
			tokens: {
				...paperTheme.tokens,
				heading: {
					fontWeight: paperTheme.tokens.heading.fontWeight,
					h1FontSize: paperTheme.tokens.heading.h1FontSize,
					h2FontSize: paperTheme.tokens.heading.h2FontSize,
					h3FontSize: paperTheme.tokens.heading.h3FontSize,
					h4FontSize: paperTheme.tokens.heading.h4FontSize,
					h5FontSize: paperTheme.tokens.heading.h5FontSize,
					h6FontSize: paperTheme.tokens.heading.h6FontSize,
				},
			},
		}

		const vars = generateCSSVariables(themeWithoutHeadingColors)

		expect(vars["--h1-color"]).toBe(paperTheme.tokens.semantic.syntax.heading)
		expect(vars["--h6-color"]).toBe(paperTheme.tokens.semantic.syntax.heading)
	})

	it("emits selection, search, and callout variables", () => {
		const vars = generateCSSVariables(paperTheme)

		expect(vars["--editor-selection-bg"]).toBe("rgba(251,113,133,0.18)")
		expect(vars["--editor-search-match-bg"]).toBe("rgba(244,63,94,0.14)")
		expect(vars["--editor-search-match-active-bg"]).toBe("rgba(251,113,133,0.30)")
		expect(vars["--callout-warning-color"]).toBe(paperTheme.tokens.status.warningForeground)
		expect(vars["--callout-warning-bg"]).toBe(paperTheme.tokens.status.warningBg)
		expect(vars["--markdown-content-width"]).toBe("720px")
		expect(vars["--markdown-content-gutter"]).toBe("40px")
		expect(vars["--markdown-code-font-family"]).toBe(
			'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
		)
		expect(vars["--markdown-code-font-size"]).toBe("14px")
		expect(vars["--markdown-code-padding-inline"]).toBe("16px")
		expect(vars["--markdown-code-padding-block"]).toBe("8px")
		expect(vars["--status-error-foreground"]).toBe(paperTheme.tokens.status.errorForeground)
		expect(vars["--status-error-on-solid"]).toBe(paperTheme.tokens.status.errorOnSolid)
		expect(vars["--settings-group-bg"]).toBe(paperTheme.tokens.component.settingsGroupBg)
		expect(vars["--settings-group-divider"]).toBe(paperTheme.tokens.component.settingsGroupDivider)
	})

	it("emits theme-specific sidebar tree guides", () => {
		expect(generateCSSVariables(paperTheme)["--sidebar-tree-guide"]).toBe("#d2d4dc")
		expect(generateCSSVariables(inkTheme)["--sidebar-tree-guide"]).toBe("#373737")
	})

	it("falls back to existing semantic colors when selection tokens are absent", () => {
		const legacyTheme: Theme = {
			...paperTheme,
			tokens: {
				...paperTheme.tokens,
				semantic: {
					...paperTheme.tokens.semantic,
					selection: undefined,
				},
			},
		}

		const vars = generateCSSVariables(legacyTheme)

		expect(vars["--editor-selection-bg"]).toBe(paperTheme.tokens.semantic.bg.selected)
		expect(vars["--editor-search-match-bg"]).toBe(paperTheme.tokens.semantic.accent.subtle)
		expect(vars["--editor-search-match-active-bg"]).toBe(paperTheme.tokens.semantic.bg.selected)
	})
})
