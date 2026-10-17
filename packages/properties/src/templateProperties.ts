import { parseFrontmatter, removeFrontmatterValue, setFrontmatterValue } from "./frontmatter"
import { getPropertiesRuntime } from "./runtime"

export async function mergeMissingNoteProperties(
	filePath: string,
	properties: Record<string, unknown>,
) {
	const added: string[] = []
	await getPropertiesRuntime().notes.updateNote(filePath, (raw) => {
		const { meta } = parseFrontmatter(raw)
		let next = raw
		for (const [key, value] of Object.entries(properties)) {
			if (Object.hasOwn(meta, key)) continue
			next = setFrontmatterValue(next, key, value ?? "")
			added.push(key)
		}
		return next
	})
	return added
}

export async function removeNoteProperties(filePath: string, keys: string[]) {
	if (keys.length === 0) return
	await getPropertiesRuntime().notes.updateNote(filePath, (raw) =>
		keys.reduce((next, key) => removeFrontmatterValue(next, key), raw),
	)
}
