import { bench, describe } from "vitest"
import { extractNoteMetadata } from "../../packages/core/src/indexing/noteMetadataIndex"
import { extractAllTags } from "../../packages/core/src/utils/frontmatter"
import { extractFrontmatterBody } from "../../packages/properties/src/frontmatter"
import { extractWikiLinks } from "../../packages/search/src/links"
import { parseTasks } from "../../packages/tasks/src"

function createNotes(count: number): Array<[string, string]> {
	return Array.from({ length: count }, (_, index) => [
		`/vault/folder-${index % 50}/note-${index}.md`,
		[
			"---",
			`tags: [project-${index % 20}, area/${index % 7}]`,
			`status: ${index % 3 === 0 ? "active" : "done"}`,
			"---",
			`# Note ${index}`,
			`Links to [[note-${(index + 1) % count}]] and [[folder-${index % 50}/note-${index % 9}|alias]].`,
			`- [ ] Task ${index} #todo 📅 2026-10-${String((index % 28) + 1).padStart(2, "0")}`,
			"- [x] Done task",
			"Some paragraph text with an #inline tag and more words to parse.".repeat(4),
		].join("\n"),
	])
}

for (const count of [2000, 50000]) {
	const notes = createNotes(count)
	describe(`note metadata parse, ${count} notes`, () => {
		bench("three separate parsers (old)", () => {
			for (const [path, content] of notes) {
				extractAllTags(content)
				extractWikiLinks(extractFrontmatterBody(content))
				parseTasks(path, content)
			}
		})
		bench("single pass (noteMetadataIndex)", () => {
			for (const [path, content] of notes) extractNoteMetadata(path, content)
		})
	})
}
