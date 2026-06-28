import { readdirSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const releaseDirectory = process.env.RELEASE_DIRECTORY ?? "dist/release"
const repo = process.env.GITHUB_REPOSITORY
const tag = process.env.RELEASE_TAG
const version = process.env.RELEASE_VERSION
const shortSha = (process.env.GITHUB_SHA ?? "").slice(0, 7)
const releaseBodyPath = process.env.RELEASE_BODY_PATH ?? "release-body.md"

if (!repo || !tag || !version || !shortSha) {
	console.error("Missing release body environment.")
	process.exit(1)
}

const files = readdirSync(releaseDirectory)
	.filter((fileName) => statSync(join(releaseDirectory, fileName)).isFile())
	.sort((first, second) => first.localeCompare(second))

function releaseAssetUrl(fileName) {
	return `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(fileName)}`
}

function matchingFiles(pattern) {
	return files.filter((fileName) => pattern.test(fileName))
}

function linkList(groupFiles) {
	return groupFiles.length > 0
		? groupFiles.map((fileName) => `- [${fileName}](${releaseAssetUrl(fileName)})`).join("\n")
		: "- Artifact unavailable"
}

function commandFor(fileName, command) {
	return fileName ? `\`${command.replace("{{file}}", fileName)}\`` : "`Arquivo indisponivel`"
}

const macosFiles = matchingFiles(/\.(dmg)$/i)
const windowsFiles = matchingFiles(/\.(msi)$/i)
const debFiles = matchingFiles(/\.deb$/i)
const appImageFiles = matchingFiles(/\.AppImage$/i)

const lines = [
	`## Cortex v${version}`,
	"",
	"Release gerada automaticamente depois do workflow de CI concluir com sucesso.",
	"",
	`- Tag: \`${tag}\``,
	`- Commit: \`${shortSha}\``,
	`- Checksums: [SHASUMS256.txt](${releaseAssetUrl("SHASUMS256.txt")})`,
	"",
	"### Downloads",
	"",
	"#### macOS Apple Silicon",
	"",
	"Baixe o DMG e arraste o Cortex para Applications.",
	"",
	linkList(macosFiles),
	"",
	"#### Windows",
	"",
	"Baixe o instalador MSI e execute normalmente.",
	"",
	linkList(windowsFiles),
	"",
	"#### Ubuntu/Debian (APT)",
	"",
	`Baixe o pacote DEB e instale com ${commandFor(debFiles[0], "sudo apt install ./{{file}}")}.`,
	"",
	linkList(debFiles),
	"",
	"#### Linux (AppImage)",
	"",
	`Baixe a AppImage, rode ${commandFor(appImageFiles[0], "chmod +x {{file}}")} e execute o arquivo.`,
	"",
	linkList(appImageFiles),
	"",
	"### Integridade",
	"",
	"Verifique os arquivos baixados comparando com `SHASUMS256.txt`.",
]

writeFileSync(releaseBodyPath, `${lines.join("\n")}\n`)
