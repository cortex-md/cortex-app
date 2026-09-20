import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import * as crypto from "./crypto"
import * as http from "./httpClient"

export interface RemoteVaultInfo {
	id: string
	name: string
	description: string | null
	ownerId: string
	role: string
	memberCount: number
	createdAt: string
	updatedAt: string
}

interface RemoteVaultResponse {
	id: string
	name: string
	description?: string | null
	owner_id: string
	role: string
	member_count?: number
	created_at: string
	updated_at: string
}

export interface SyncConfig {
	enabled: boolean
	remoteVaultId: string | null
	selfHosted: boolean
	serverUrl: string | null
	offlineMode: boolean
	selfHostedEnvironment: Record<string, string>
}

function mapVault(raw: RemoteVaultResponse): RemoteVaultInfo {
	return {
		id: raw.id,
		name: raw.name,
		description: raw.description ?? null,
		ownerId: raw.owner_id,
		role: raw.role,
		memberCount: raw.member_count ?? 0,
		createdAt: raw.created_at,
		updatedAt: raw.updated_at,
	}
}

function syncConfigPath(vaultPath: string): string {
	return join(vaultPath, ".cortex", "sync-config.json")
}

function readSyncConfig(vaultPath: string): Record<string, unknown> {
	const path = syncConfigPath(vaultPath)
	if (!existsSync(path)) return {}
	try {
		return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>
	} catch {
		return {}
	}
}

function writeSyncConfig(vaultPath: string, config: Record<string, unknown>): void {
	const dir = join(vaultPath, ".cortex")
	mkdirSync(dir, { recursive: true })
	writeFileSync(syncConfigPath(vaultPath), JSON.stringify(config, null, 2), "utf8")
}

export async function remoteVaultCreate(
	name: string,
	description?: string | null,
): Promise<RemoteVaultInfo> {
	const vek = crypto.generateVek()
	const response = await http.postJson("/vaults/v1/", {
		name,
		description: description ?? null,
		encrypted_vault_key: vek.toString("base64"),
	})
	const raw = await http.parseResponse<RemoteVaultResponse>(response)
	const vault = mapVault(raw)
	crypto.storeVek(vault.id, vek)
	return vault
}

export async function remoteVaultList(): Promise<RemoteVaultInfo[]> {
	const response = await http.get("/vaults/v1/")
	const raw = await http.parseResponse<RemoteVaultResponse[]>(response)
	return raw.map(mapVault)
}

export async function remoteVaultGet(vaultId: string): Promise<RemoteVaultInfo> {
	const response = await http.get(`/vaults/v1/${vaultId}/`)
	const raw = await http.parseResponse<RemoteVaultResponse>(response)
	return mapVault(raw)
}

export async function remoteVaultUpdate(
	vaultId: string,
	name?: string | null,
	description?: string | null,
): Promise<RemoteVaultInfo> {
	const response = await http.patchJson(`/vaults/v1/${vaultId}/`, {
		name: name ?? null,
		description: description ?? null,
	})
	const raw = await http.parseResponse<RemoteVaultResponse>(response)
	return mapVault(raw)
}

export async function remoteVaultDelete(vaultId: string): Promise<void> {
	const response = await http.deleteRequest(`/vaults/v1/${vaultId}/`)
	if (!response.ok) {
		const body = await response.text().catch(() => "")
		throw new Error(`HTTP ${response.status}: ${body}`)
	}
}

export function remoteVaultLink(vaultPath: string, remoteVaultId: string): void {
	const config = readSyncConfig(vaultPath)
	config.remoteVaultId = remoteVaultId
	writeSyncConfig(vaultPath, config)
}

export function remoteVaultUnlink(vaultPath: string): void {
	const config = readSyncConfig(vaultPath)
	delete config.remoteVaultId
	writeSyncConfig(vaultPath, config)
}

export function remoteVaultGetLink(vaultPath: string): string | null {
	const config = readSyncConfig(vaultPath)
	return typeof config.remoteVaultId === "string" ? config.remoteVaultId : null
}

export function syncConfigRead(vaultPath: string): SyncConfig {
	const config = readSyncConfig(vaultPath)
	return {
		enabled: Boolean(config.enabled),
		remoteVaultId: typeof config.remoteVaultId === "string" ? config.remoteVaultId : null,
		selfHosted: Boolean(config.selfHosted),
		serverUrl: typeof config.serverUrl === "string" ? config.serverUrl : null,
		offlineMode: Boolean(config.offlineMode),
		selfHostedEnvironment:
			typeof config.selfHostedEnvironment === "object" && config.selfHostedEnvironment
				? (config.selfHostedEnvironment as Record<string, string>)
				: {},
	}
}

export function syncConfigUpdate(vaultPath: string, key: string, value: unknown): void {
	const config = readSyncConfig(vaultPath)
	config[key] = value
	writeSyncConfig(vaultPath, config)
}
