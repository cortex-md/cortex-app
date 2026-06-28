import { execFileSync } from "node:child_process"
import { join } from "node:path"

const releaseDirectory = process.env.RELEASE_DIRECTORY ?? "dist/release"
const repo = process.env.GITHUB_REPOSITORY
const tag = process.env.RELEASE_TAG
const version = process.env.RELEASE_VERSION
const pubDate = process.env.RELEASE_PUB_DATE ?? new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
const notesPath = process.env.RELEASE_NOTES_PATH ?? process.env.RELEASE_BODY_PATH ?? "release-body.md"
const outputPath = process.env.RELEASE_MANIFEST_PATH ?? join(releaseDirectory, "latest.json")

if (!repo || !tag || !version) {
	console.error("Missing updater manifest environment.")
	process.exit(1)
}

execFileSync(
	"bun",
	[
		"run",
		"scripts/generate-tauri-updater-manifest.ts",
		"--release-dir",
		releaseDirectory,
		"--repo",
		repo,
		"--tag",
		tag,
		"--version",
		version,
		"--pub-date",
		pubDate,
		"--notes",
		notesPath,
		"--out",
		outputPath,
	],
	{ stdio: "inherit" },
)
