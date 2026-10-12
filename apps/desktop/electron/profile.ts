import { join } from "node:path"
import { app } from "electron"

const PROFILE_ARG = "--profile="
const PROFILE_ENV = "CORTEX_PROFILE"
const PROFILE_NAME = /^[a-z0-9][a-z0-9_-]{0,31}$/i

let activeProfile: string | null = null

function readProfileName(): string | null {
	const fromArg = process.argv.find((arg) => arg.startsWith(PROFILE_ARG))?.slice(PROFILE_ARG.length)
	const name = fromArg ?? process.env[PROFILE_ENV]
	if (!name) return null
	if (!PROFILE_NAME.test(name)) throw new Error(`Invalid profile name: ${name}`)
	return name
}

export function applyDevelopmentProfile(): string | null {
	if (app.isPackaged) return null
	const name = readProfileName()
	if (!name) return null
	const userData = join(app.getPath("appData"), `${app.getName()}-profile-${name}`)
	app.setPath("userData", userData)
	app.setPath("sessionData", userData)
	activeProfile = name
	return name
}

export function getActiveProfile(): string | null {
	return activeProfile
}
