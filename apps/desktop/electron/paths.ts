import { join } from "node:path"
import { app } from "electron"

export function userDataPath(...segments: string[]): string {
	return join(app.getPath("userData"), ...segments)
}

export const vaultsRegistryPath = () => userDataPath("vaults.json")

export const appSettingsPath = () => userDataPath("settings.json")

export const credentialsPath = () => userDataPath("credentials.bin")

export const windowStatePath = () => userDataPath("window-state.json")
