import { readFileSync, writeFileSync } from "node:fs"

const version = process.env.RELEASE_VERSION
const packageJsonPath = "apps/desktop/package.json"

if (!version) {
	console.error("Missing RELEASE_VERSION.")
	process.exit(1)
}

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
packageJson.version = version
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, "\t")}\n`)
