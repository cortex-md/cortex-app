import { cpSync, mkdirSync, readdirSync } from "node:fs"
import { basename, join } from "node:path"

const artifactsDirectory = process.env.RELEASE_ARTIFACTS_DIRECTORY ?? "release-artifacts"
const releaseDirectory = process.env.RELEASE_DIRECTORY ?? "dist/release"

mkdirSync(releaseDirectory, { recursive: true })

for (const assetPath of listFiles(artifactsDirectory)) {
	cpSync(assetPath, join(releaseDirectory, basename(assetPath)))
}

function listFiles(directory) {
	const files = []
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name)
		if (entry.isDirectory()) {
			files.push(...listFiles(path))
		} else if (entry.isFile()) {
			files.push(path)
		}
	}
	return files
}
