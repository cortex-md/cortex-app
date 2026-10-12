import type { CollabNoteParts } from "@cortex/collab"
import { locateFrontmatter } from "@cortex/properties"

export function splitNoteParts(rawContent: string): CollabNoteParts {
	const location = locateFrontmatter(rawContent)
	const frontmatterEnd = location?.to ?? 0
	return {
		frontmatter: rawContent.slice(0, frontmatterEnd),
		body: rawContent.slice(frontmatterEnd),
	}
}

export function joinNoteParts(parts: CollabNoteParts): string {
	return `${parts.frontmatter}${parts.body}`
}
