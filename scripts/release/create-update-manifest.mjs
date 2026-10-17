import { createHash, createPrivateKey, sign } from "node:crypto"
import { createReadStream } from "node:fs"
import { mkdir, readdir, stat, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"

const REPOSITORY = "cortex-md/cortex-app"
const PRODUCT_NAME = "Cortex"

const PLATFORMS = {
	"darwin-arm64": { type: "zip", os: "mac", arch: ["arm64"], ext: "zip" },
	"darwin-x64": { type: "zip", os: "mac", arch: ["x64"], ext: "zip" },
	"win32-x64": { type: "nsis", os: "win", arch: ["x64"], ext: "exe" },
	"win32-arm64": { type: "nsis", os: "win", arch: ["arm64"], ext: "exe" },
	"linux-x64": { type: "appimage", os: "linux", arch: ["x86_64", "x64"], ext: "AppImage" },
	"linux-arm64": { type: "appimage", os: "linux", arch: ["arm64", "aarch64"], ext: "AppImage" },
}

function fail(message) {
	console.error(message)
	process.exit(1)
}

const version = process.env.RELEASE_VERSION ?? ""
const tagName = process.env.RELEASE_TAG ?? `v${version}`
const artifactsDir = process.env.ARTIFACTS_DIR ?? "artifacts"
const outputDir = process.env.OUTPUT_DIR ?? "update-manifest"
const required = (process.env.REQUIRED_PLATFORMS ?? "").split(",").filter(Boolean)
const privateKeyBase64 = process.env.CORTEX_UPDATE_PRIVATE_KEY ?? ""

if (!/^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$/.test(version)) fail(`Invalid version: ${version}`)
if (!privateKeyBase64) fail("CORTEX_UPDATE_PRIVATE_KEY is not set")
for (const key of required) if (!PLATFORMS[key]) fail(`Unknown platform: ${key}`)

async function listFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true })
	const nested = await Promise.all(
		entries.map((entry) => {
			const path = join(directory, entry.name)
			return entry.isDirectory() ? listFiles(path) : [path]
		}),
	)
	return nested.flat()
}

function sha256(path) {
	return new Promise((resolve, reject) => {
		const hash = createHash("sha256")
		createReadStream(path)
			.on("data", (chunk) => hash.update(chunk))
			.on("error", reject)
			.on("end", () => resolve(hash.digest("hex")))
	})
}

const files = await listFiles(artifactsDir)
const platforms = {}
for (const [key, spec] of Object.entries(PLATFORMS)) {
	const names = spec.arch.map((arch) => `${PRODUCT_NAME}-${version}-${spec.os}-${arch}.${spec.ext}`)
	const matches = files.filter((file) => names.includes(basename(file)))
	if (matches.length > 1) fail(`More than one artifact for ${key}: ${matches.join(", ")}`)
	const [path] = matches
	if (!path) continue
	const name = basename(path)
	const [digest, info] = await Promise.all([sha256(path), stat(path)])
	platforms[key] = {
		type: spec.type,
		url: `https://github.com/${REPOSITORY}/releases/download/${tagName}/${encodeURIComponent(name)}`,
		sha256: digest,
		size: info.size,
	}
	console.log(`${key}: ${name} (${info.size} bytes)`)
}

const missing = required.filter((key) => !platforms[key])
if (missing.length > 0) fail(`Missing update artifacts for: ${missing.join(", ")}`)

const manifest = {
	version,
	channel: version.includes("-") ? "beta" : "stable",
	releasedAt: new Date().toISOString(),
	notes: process.env.RELEASE_NOTES ?? "",
	platforms,
}

const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)
const privateKey = createPrivateKey({
	key: Buffer.from(privateKeyBase64, "base64"),
	format: "der",
	type: "pkcs8",
})
if (privateKey.asymmetricKeyType !== "ed25519") fail("CORTEX_UPDATE_PRIVATE_KEY is not an Ed25519 key")
const signature = sign(null, manifestBytes, privateKey).toString("base64")

await mkdir(outputDir, { recursive: true })
await writeFile(join(outputDir, "latest.json"), manifestBytes)
await writeFile(join(outputDir, "latest.json.sig"), `${signature}\n`)
console.log(`Signed update manifest for ${version} (${manifest.channel}) in ${outputDir}`)
