import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { normalizePath, vaultsRegistryPath } from "../paths"

export interface VaultRegistryEntry {
	uuid: string
	path: string
	name: string
	lastOpened: number
	icon?: string | null
	color?: string | null
}

type RegistryChangedListener = () => void

let registryChangedListener: RegistryChangedListener | null = null

export function setRegistryChangedListener(listener: RegistryChangedListener | null): void {
	registryChangedListener = listener
}

function notifyRegistryChanged(): void {
	registryChangedListener?.()
}

function ensureRegistryParent(): string {
	const path = vaultsRegistryPath()
	mkdirSync(dirname(path), { recursive: true })
	return path
}

export function readVaultRegistry(): VaultRegistryEntry[] {
	const path = ensureRegistryParent()
	if (!existsSync(path)) return []
	const content = readFileSync(path, "utf8")
	const entries = JSON.parse(content) as VaultRegistryEntry[]
	return entries.map((entry) => ({
		...entry,
		path: normalizePath(entry.path),
	}))
}

function writeRegistry(entries: VaultRegistryEntry[]): void {
	const path = ensureRegistryParent()
	writeFileSync(path, JSON.stringify(entries, null, 2), "utf8")
}

export function updateVaultRegistry(
	uuid: string,
	path: string,
	name: string,
	icon?: string | null,
	color?: string | null,
): void {
	const entries = readVaultRegistry()
	const now = Math.floor(Date.now() / 1000)
	const existing = entries.find((entry) => entry.uuid === uuid)
	if (existing) {
		existing.path = normalizePath(path)
		existing.name = name
		existing.lastOpened = now
		if (icon !== undefined) existing.icon = icon
		if (color !== undefined) existing.color = color
	} else {
		entries.push({
			uuid,
			path: normalizePath(path),
			name,
			lastOpened: now,
			icon: icon ?? null,
			color: color ?? null,
		})
	}
	writeRegistry(entries)
	notifyRegistryChanged()
}

export function removeFromVaultRegistry(uuid: string): void {
	const path = ensureRegistryParent()
	if (!existsSync(path)) return
	const entries = readVaultRegistry().filter((entry) => entry.uuid !== uuid)
	writeRegistry(entries)
	notifyRegistryChanged()
}
