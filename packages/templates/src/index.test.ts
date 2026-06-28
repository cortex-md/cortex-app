import { describe, expect, it } from "vitest"
import {
	renderTemplate,
	renderTemplateExpression,
	type TemplateRenderContext,
	validateTemplateManifest,
} from "."

const context: TemplateRenderContext = {
	now: new Date(2026, 5, 18, 14, 5, 6),
	vault: { name: "Research Vault", path: "/vault" },
	note: { title: "Weekly Review", fileName: "weekly-review.md", folder: "Reviews" },
	template: { id: "weekly", name: "Weekly Template" },
	customPlaceholders: {
		"note.slug": "note.title | slug",
		"note.heading": "# {{ note.title | title }}",
	},
}

describe("renderTemplate", () => {
	it("renders built-in placeholders", () => {
		expect(renderTemplate("# {{ note.title }} in {{ vault.name }}", context).value).toBe(
			"# Weekly Review in Research Vault",
		)
	})

	it("applies filters in order", () => {
		expect(renderTemplateExpression('note.title | lower | replace(" ", "-")', context)).toBe(
			"weekly-review",
		)
	})

	it("formats dates with patterns", () => {
		expect(renderTemplateExpression('now | date("yyyy-MM-dd HH:mm")', context)).toBe(
			"2026-06-18 14:05",
		)
		expect(renderTemplateExpression("date.week", context)).toBe("25")
	})

	it("renders custom placeholders as expressions or nested templates", () => {
		expect(renderTemplateExpression("note.slug", context)).toBe("weekly-review")
		expect(renderTemplateExpression("note.heading", context)).toBe("# Weekly Review")
	})

	it("detects recursive custom placeholders", () => {
		expect(() =>
			renderTemplateExpression("loop", {
				...context,
				customPlaceholders: { loop: "loop" },
			}),
		).toThrow("recursive")
	})

	it("renders unknown placeholders as empty values and throws clear filter errors", () => {
		expect(renderTemplateExpression("missing.value", context)).toBe("")
		expect(() => renderTemplateExpression("note.title | nope", context)).toThrow(
			'Unknown template filter "nope"',
		)
	})
})

describe("validateTemplateManifest", () => {
	it("validates manifest shape", () => {
		const manifest = validateTemplateManifest({
			version: 1,
			templates: [
				{
					id: "daily",
					name: "Daily",
					bodyPath: "daily.md",
					targetFolderPattern: "Daily",
					fileNamePattern: "{{ date.today }}",
					customPlaceholders: { slug: "note.title | slug" },
					createdAt: "2026-06-18T00:00:00.000Z",
					updatedAt: "2026-06-18T00:00:00.000Z",
				},
			],
		})
		expect(manifest.templates[0].fileNamePattern).toBe("{{ date.today }}")
	})

	it("normalizes safe template body paths", () => {
		const manifest = validateTemplateManifest({
			version: 1,
			templates: [
				{
					id: "daily",
					name: "Daily",
					bodyPath: "nested\\daily.md",
					createdAt: "2026-06-18T00:00:00.000Z",
					updatedAt: "2026-06-18T00:00:00.000Z",
				},
			],
		})

		expect(manifest.templates[0].bodyPath).toBe("nested/daily.md")
	})

	it("rejects template body paths outside the template directory", () => {
		const template = {
			id: "daily",
			name: "Daily",
			createdAt: "2026-06-18T00:00:00.000Z",
			updatedAt: "2026-06-18T00:00:00.000Z",
		}
		for (const bodyPath of ["../secret.md", "/tmp/template.md", "C:\\tmp\\template.md"]) {
			expect(() =>
				validateTemplateManifest({
					version: 1,
					templates: [{ ...template, bodyPath }],
				}),
			).toThrow("safe relative path")
		}
	})

	it("rejects duplicate template ids", () => {
		const template = {
			id: "daily",
			name: "Daily",
			bodyPath: "daily.md",
			createdAt: "2026-06-18T00:00:00.000Z",
			updatedAt: "2026-06-18T00:00:00.000Z",
		}
		expect(() => validateTemplateManifest({ version: 1, templates: [template, template] })).toThrow(
			'Duplicate template id "daily"',
		)
	})
})
