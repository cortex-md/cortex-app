import { copyFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const releaseDirectory = process.env.RELEASE_DIRECTORY ?? "dist/release"

const aliasRules = [
	{
		alias: "Cortex-macos-aarch64.dmg",
		pattern: /^Cortex_.+_aarch64\.dmg$/i,
	},
	{
		alias: "Cortex-windows-x64.msi",
		pattern: /^Cortex_.+_x64(?:_[\w-]+)?\.msi$/i,
	},
	{
		alias: "Cortex-windows-x64.msi.sig",
		pattern: /^Cortex_.+_x64(?:_[\w-]+)?\.msi\.sig$/i,
	},
	{
		alias: "Cortex-linux-x64.AppImage",
		pattern: /^Cortex_.+_amd64\.AppImage$/i,
	},
	{
		alias: "Cortex-linux-x64.AppImage.sig",
		pattern: /^Cortex_.+_amd64\.AppImage\.sig$/i,
	},
	{
		alias: "Cortex-linux-amd64.deb",
		pattern: /^Cortex_.+_amd64\.deb$/i,
	},
]

const files = readdirSync(releaseDirectory)
	.filter((fileName) => statSync(join(releaseDirectory, fileName)).isFile())
	.sort((first, second) => first.localeCompare(second))

const missingAliases = []

for (const rule of aliasRules) {
	const source = files.find((fileName) => fileName !== rule.alias && rule.pattern.test(fileName))
	if (!source) {
		missingAliases.push(rule.alias)
		continue
	}

	copyFileSync(join(releaseDirectory, source), join(releaseDirectory, rule.alias))
	console.log(`${rule.alias} -> ${source}`)
}

if (missingAliases.length > 0) {
	console.error(`Missing release assets for stable aliases: ${missingAliases.join(", ")}`)
	process.exit(1)
}
