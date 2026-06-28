import { describe, expect, it } from "vitest"
import { extractThemeTokenMap } from "./extractThemeTokenMap"

describe("extractThemeTokenMap", () => {
	it("merges root tokens with the selected scheme", () => {
		const result = extractThemeTokenMap(
			`
				:root {
					--background: #ffffff;
					--foreground: var(--ink);
				}
				.theme-quiet-dark {
					--background: #111111;
					--ink: #eeeeee;
					color: red;
				}
				.theme-quiet-light {
					--background: #fafafa;
				}
			`,
			{ theme: "quiet", colorScheme: "dark" },
		)

		expect(result).toEqual({
			theme: "quiet",
			colorScheme: "dark",
			tokens: {
				"--background": "#111111",
				"--foreground": "#eeeeee",
				"--ink": "#eeeeee",
			},
		})
	})

	it("supports custom selectors and nested fallbacks", () => {
		const result = extractThemeTokenMap(
			`
				:root {
					--fallback: #222222;
					--border: var(--missing, var(--fallback, #ffffff));
				}
				[data-theme="paper"] {
					--accent: var(--brand);
				}
			`,
			{
				theme: "paper",
				colorScheme: "light",
				selector: '[data-theme="paper"]',
				baseTokens: {
					"--brand": "#955f0b",
				},
			},
		)

		expect(result.tokens).toEqual({
			"--brand": "#955f0b",
			"--fallback": "#222222",
			"--border": "#222222",
			"--accent": "#955f0b",
		})
	})

	it("resolves multiple variables in one token value", () => {
		const result = extractThemeTokenMap(
			`
				:root {
					--space: 8px;
					--radius: 4px;
					--frame: calc(var(--space) + var(--radius));
				}
			`,
			{ theme: "quiet", colorScheme: "dark" },
		)

		expect(result.tokens["--frame"]).toBe("calc(8px + 4px)")
	})

	it("resolves transitive references and uses base tokens to break overrides cycles", () => {
		const result = extractThemeTokenMap(
			`
				.theme-quiet-dark {
					--accent: var(--accent-hover);
					--accent-hover: var(--accent);
					--button: var(--accent-hover);
				}
			`,
			{
				theme: "quiet",
				colorScheme: "dark",
				baseTokens: {
					"--accent": "#1f6feb",
				},
			},
		)

		expect(result.tokens).toEqual({
			"--accent": "#1f6feb",
			"--accent-hover": "#1f6feb",
			"--button": "#1f6feb",
		})
	})

	it("omits unresolved cycles and ignores non-token declarations", () => {
		const result = extractThemeTokenMap(
			`
				:root {
					color: red;
					--first: var(--second);
					--second: var(--first);
				}
				@media (prefers-color-scheme: dark) {
					:root {
						--nested-root: #111111;
					}
					.theme-quiet-dark {
						--nested-theme: #222222;
					}
					body {
						--ignored: #000000;
					}
				}
			`,
			{ theme: "quiet", colorScheme: "dark" },
		)

		expect(result.tokens).toEqual({})
	})
})
