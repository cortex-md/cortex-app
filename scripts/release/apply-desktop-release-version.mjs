import { readFileSync, writeFileSync } from "node:fs"

const version = process.env.RELEASE_VERSION

if (!version) {
	console.error("Missing RELEASE_VERSION.")
	process.exit(1)
}

function updateJsonVersion(filePath) {
	const packageJson = JSON.parse(readFileSync(filePath, "utf8"))
	packageJson.version = version
	writeFileSync(filePath, `${JSON.stringify(packageJson, null, "\t")}\n`)
}

updateJsonVersion("apps/desktop/package.json")
updateJsonVersion("apps/desktop/src-tauri/tauri.conf.json")

const cargoPath = "apps/desktop/src-tauri/Cargo.toml"
const cargoToml = readFileSync(cargoPath, "utf8")
writeFileSync(cargoPath, cargoToml.replace(/^version = ".*"$/m, `version = "${version}"`))
