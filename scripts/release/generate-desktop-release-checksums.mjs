import { createHash } from "node:crypto"
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const releaseDirectory = process.env.RELEASE_DIRECTORY ?? "dist/release"
const checksumFileName = "SHASUMS256.txt"

const checksumLines = readdirSync(releaseDirectory)
	.filter((fileName) => fileName !== checksumFileName)
	.filter((fileName) => statSync(join(releaseDirectory, fileName)).isFile())
	.sort((first, second) => first.localeCompare(second))
	.map((fileName) => `${sha256(join(releaseDirectory, fileName))}  ${fileName}`)

writeFileSync(join(releaseDirectory, checksumFileName), `${checksumLines.join("\n")}\n`)

function sha256(filePath) {
	return createHash("sha256").update(readFileSync(filePath)).digest("hex")
}
