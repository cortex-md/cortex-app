import { getContrastRatio, inkTheme, paperTheme, resolveAccessibleForeground } from "@cortex/theme"
import { describe, expect, it } from "vitest"

describe("theme contrast", () => {
	it("keeps built-in foregrounds and controls above their minimum contrast", () => {
		expect(
			getContrastRatio(
				paperTheme.tokens.semantic.text.primary,
				paperTheme.tokens.semantic.bg.primary,
			),
		).toBeGreaterThanOrEqual(4.5)
		expect(
			getContrastRatio(
				paperTheme.tokens.semantic.accent.text,
				paperTheme.tokens.semantic.accent.subtle,
			),
		).toBeGreaterThanOrEqual(4.5)
		expect(
			getContrastRatio(inkTheme.tokens.status.warningForeground, inkTheme.tokens.status.warningBg),
		).toBeGreaterThanOrEqual(4.5)
		expect(
			getContrastRatio(
				paperTheme.tokens.semantic.border.focus,
				paperTheme.tokens.semantic.bg.primary,
			),
		).toBeGreaterThanOrEqual(3)
		expect(
			getContrastRatio(
				paperTheme.tokens.heading.h1Color ?? paperTheme.tokens.semantic.syntax.heading,
				paperTheme.tokens.semantic.bg.primary,
			),
		).toBeGreaterThanOrEqual(4.5)
		expect(
			getContrastRatio(
				inkTheme.tokens.heading.h1Color ?? inkTheme.tokens.semantic.syntax.heading,
				inkTheme.tokens.semantic.bg.primary,
			),
		).toBeGreaterThanOrEqual(4.5)
		expect(
			getContrastRatio(
				paperTheme.tokens.component.btnPrimaryText,
				paperTheme.tokens.component.btnPrimaryBg,
			),
		).toBeGreaterThanOrEqual(4.5)
		expect(
			getContrastRatio(
				inkTheme.tokens.component.btnPrimaryText,
				inkTheme.tokens.component.btnPrimaryBg,
			),
		).toBeGreaterThanOrEqual(4.5)
	})

	it.each([
		"#ffffff",
		"#0a0a09",
		"#ffd400",
		"#1f6feb",
	])("resolves an accessible foreground for %s", (accent) => {
		const foreground = resolveAccessibleForeground(accent)
		expect(getContrastRatio(foreground, accent)).toBeGreaterThanOrEqual(4.5)
	})
})
