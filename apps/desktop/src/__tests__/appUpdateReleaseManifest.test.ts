import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"

let releaseDirectory: string | null = null

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..")
const manifestScriptPath = join(repoRoot, "scripts/generate-tauri-updater-manifest.ts")

function writeReleaseFile(fileName: string, content = "asset"): void {
	if (!releaseDirectory) throw new Error("Release directory not initialized")
	writeFileSync(join(releaseDirectory, fileName), content)
}

function generateManifestFile(outputPath: string): void {
	if (!releaseDirectory) throw new Error("Release directory not initialized")
	execFileSync(
		"bun",
		[
			"run",
			manifestScriptPath,
			"--release-dir",
			releaseDirectory,
			"--repo",
			"cortex-md/cortex-app",
			"--tag",
			"v0.1.0",
			"--version",
			"0.1.0",
			"--pub-date",
			"2026-06-21T00:00:00Z",
			"--notes",
			join(releaseDirectory, "release-body.md"),
			"--out",
			outputPath,
		],
		{ cwd: repoRoot, stdio: "pipe" },
	)
}

afterEach(() => {
	if (releaseDirectory) rmSync(releaseDirectory, { recursive: true, force: true })
	releaseDirectory = null
})

describe("generateUpdaterManifest", () => {
	it("maps signed updater artifacts to Tauri updater platform keys", () => {
		releaseDirectory = mkdtempSync(join(tmpdir(), "cortex-release-"))
		writeReleaseFile("Cortex.app.tar.gz")
		writeReleaseFile("Cortex.app.tar.gz.sig", "mac-signature")
		writeReleaseFile("Cortex.msi")
		writeReleaseFile("Cortex.msi.sig", "windows-signature")
		writeReleaseFile("Cortex.AppImage")
		writeReleaseFile("Cortex.AppImage.sig", "linux-signature")
		writeReleaseFile("release-body.md", "# Cortex 0.1.0\n\nInitial stable release.")
		const outputPath = join(releaseDirectory, "latest.json")

		generateManifestFile(outputPath)

		const manifest = JSON.parse(readFileSync(outputPath, "utf8"))

		expect(manifest).toMatchObject({
			version: "0.1.0",
			notes: "# Cortex 0.1.0\n\nInitial stable release.",
			pub_date: "2026-06-21T00:00:00Z",
			platforms: {
				"darwin-aarch64": { signature: "mac-signature" },
				"windows-x86_64": { signature: "windows-signature" },
				"linux-x86_64": { signature: "linux-signature" },
			},
		})
		expect(manifest.platforms["darwin-aarch64"].url).toBe(
			"https://github.com/cortex-md/cortex-app/releases/download/v0.1.0/Cortex.app.tar.gz",
		)
	})

	it("keeps the updater on stable GitHub releases", () => {
		const workflow = readFileSync(join(repoRoot, ".github/workflows/release.yml"), "utf8")
		const rustCommand = readFileSync(
			join(repoRoot, "apps/desktop/src-tauri/src/commands/app_update.rs"),
			"utf8",
		)

		expect(workflow).not.toContain("updater-beta")
		expect(workflow).not.toContain("docs/releases")
		expect(workflow).not.toContain("changelog.md")
		expect(workflow).not.toContain("node <<")
		expect(workflow).toContain("scripts/release/prepare-desktop-release-assets.mjs")
		expect(workflow).toContain("scripts/release/generate-desktop-updater-manifest.mjs")
		expect(workflow).toContain("scripts/release/generate-desktop-release-checksums.mjs")
		expect(rustCommand).toContain(
			"https://github.com/cortex-md/cortex-app/releases/latest/download/latest.json",
		)
		expect(rustCommand).toContain("https://api.github.com/repos/cortex-md/cortex-app/releases/tags")
	})
})
