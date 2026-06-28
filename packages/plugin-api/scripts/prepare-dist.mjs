import { copyFileSync, readFileSync, writeFileSync } from "node:fs"

const globalsSourceUrl = new URL("../src/globals.d.ts", import.meta.url)
const globalsDistUrl = new URL("../dist/globals.d.ts", import.meta.url)
const indexDistUrl = new URL("../dist/index.d.ts", import.meta.url)
const globalsReference = '/// <reference path="./globals.d.ts" />\n'

copyFileSync(globalsSourceUrl, globalsDistUrl)

const indexTypes = readFileSync(indexDistUrl, "utf8")
writeFileSync(
	indexDistUrl,
	indexTypes.startsWith(globalsReference)
		? indexTypes
		: `${globalsReference}${indexTypes}`,
)
