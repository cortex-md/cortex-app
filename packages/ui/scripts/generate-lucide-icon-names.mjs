import { writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const packageRoot = dirname(require.resolve("lucide-react/package.json"))
const { default: dynamicIconImports } = await import(
	join(packageRoot, "dist/esm/dynamicIconImports.js")
)
const names = Object.keys(dynamicIconImports).sort()
const sourceDir = join(dirname(fileURLToPath(import.meta.url)), "../src")

const toExportName = (name) =>
	name
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("")

writeFileSync(
	join(sourceDir, "lucide-icon-names.ts"),
	`export const LUCIDE_ICON_NAMES =\n\t"${names.join("|")}"\n`,
)
const exportNames = [...new Set(names.map(toExportName))]

writeFileSync(
	join(sourceDir, "lucide-lazy-icons.ts"),
	[
		"import {",
		...exportNames.map((name) => `\t${name}Icon,`),
		'} from "lucide-react"',
		"",
		"export const lazyLucideIcons = {",
		...names.map((name) => `\t"${name}": ${toExportName(name)}Icon,`),
		"}",
		"",
	].join("\n"),
)
console.log(`wrote ${names.length} icon names`)
