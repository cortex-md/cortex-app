import { homedir } from "node:os"
import { join } from "node:path"

export function normalizePath(path: string): string {
	return path.replaceAll("\\", "/")
}

export function cortexHomeDir(): string {
	return join(homedir(), ".cortex")
}

export function vaultsRegistryPath(): string {
	return join(cortexHomeDir(), "vaults.json")
}

export function settingsPath(): string {
	return join(cortexHomeDir(), "settings.json")
}

export function credentialsPath(): string {
	return join(cortexHomeDir(), "credentials.enc")
}

export function credentialsKeyPath(): string {
	return join(cortexHomeDir(), "credentials.key")
}
