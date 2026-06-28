import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export interface UpdaterManifestInput {
	releaseDirectory: string
	repo: string
	tag: string
	version: string
	pubDate: string
	notesPath: string
}

interface PlatformAssetRule {
	key: string
	artifact: RegExp
	signature: RegExp
}

interface PlatformManifestEntry {
	signature: string
	url: string
}

interface UpdaterManifest {
	version: string
	notes: string
	pub_date: string
	platforms: Record<string, PlatformManifestEntry>
}

const platformAssetRules: PlatformAssetRule[] = [
	{
		key: "darwin-aarch64",
		artifact: /\.app\.tar\.gz$/i,
		signature: /\.app\.tar\.gz\.sig$/i,
	},
	{
		key: "windows-x86_64",
		artifact: /\.msi$/i,
		signature: /\.msi\.sig$/i,
	},
	{
		key: "linux-x86_64",
		artifact: /\.AppImage$/i,
		signature: /\.AppImage\.sig$/i,
	},
]

export function generateUpdaterManifest(input: UpdaterManifestInput): UpdaterManifest {
	const files = readdirSync(input.releaseDirectory)
		.filter((fileName) => statSync(join(input.releaseDirectory, fileName)).isFile())
		.sort((first, second) => first.localeCompare(second))
	const notes = readFileSync(input.notesPath, "utf8").trim()
	const platforms: Record<string, PlatformManifestEntry> = {}

	for (const rule of platformAssetRules) {
		const artifact = files.find((fileName) => rule.artifact.test(fileName))
		const signatureFile = files.find((fileName) => rule.signature.test(fileName))
		if (!artifact || !signatureFile) {
			throw new Error(`Missing updater artifact or signature for ${rule.key}`)
		}
		platforms[rule.key] = {
			signature: readFileSync(join(input.releaseDirectory, signatureFile), "utf8").trim(),
			url: releaseAssetUrl(input.repo, input.tag, artifact),
		}
	}

	return {
		version: input.version,
		notes,
		pub_date: input.pubDate,
		platforms,
	}
}

function releaseAssetUrl(repo: string, tag: string, fileName: string): string {
	return `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(fileName)}`
}

function readArgs(): Record<string, string> {
	const args = process.argv.slice(2)
	const values: Record<string, string> = {}
	for (let index = 0; index < args.length; index += 2) {
		const key = args[index]?.replace(/^--/, "")
		const value = args[index + 1]
		if (!key || value === undefined) continue
		values[key] = value
	}
	return values
}

function requireArg(args: Record<string, string>, key: string): string {
	const value = args[key]
	if (!value) throw new Error(`Missing --${key}`)
	return value
}

function isCliEntry(): boolean {
	return process.argv[1]?.endsWith("generate-tauri-updater-manifest.ts") ?? false
}

if (isCliEntry()) {
	const args = readArgs()
	const outputPath = requireArg(args, "out")
	const manifest = generateUpdaterManifest({
		releaseDirectory: requireArg(args, "release-dir"),
		repo: requireArg(args, "repo"),
		tag: requireArg(args, "tag"),
		version: requireArg(args, "version"),
		pubDate: requireArg(args, "pub-date"),
		notesPath: requireArg(args, "notes"),
	})
	writeFileSync(outputPath, `${JSON.stringify(manifest, null, "\t")}\n`)
}
