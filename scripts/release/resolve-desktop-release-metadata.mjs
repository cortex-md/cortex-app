import { appendFileSync } from "node:fs"

const inputVersion = process.env.RELEASE_VERSION_INPUT ?? ""
const refName = process.env.GITHUB_REF_NAME ?? ""
const outputPath = process.env.GITHUB_OUTPUT

const version = (inputVersion || refName).replace(/^v/, "")
const tagName = `v${version}`

if (!/^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$/.test(version)) {
	console.error(`Invalid release version: ${version}`)
	console.error("Use a semver version such as 0.1.0 or 0.2.0-beta.1.")
	process.exit(1)
}

const isPrerelease = version.includes("-")
const output = `tag_name=${tagName}\nversion=${version}\nis_prerelease=${isPrerelease}\n`

if (outputPath) {
	appendFileSync(outputPath, output)
} else {
	process.stdout.write(output)
}
