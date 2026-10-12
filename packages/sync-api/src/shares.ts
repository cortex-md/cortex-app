import type { ApiClient } from "./client"
import { segment } from "./client"
import { expectOk } from "./errors"
import { optionalString, toItems, toRecord } from "./mappers"

export interface RemoteShare {
	id: string
	vaultId: string
	filePath: string
	url: string
	wrappedKey: string
	revision: number
	sizeBytes: number
	expiresAt: string | null
	createdBy: string
	createdAt: string
	updatedAt: string
}

function sharesPath(vaultId: string, suffix = ""): string {
	return `/sync/v1/vaults/${segment(vaultId)}/shares${suffix}`
}

function mapShare(payload: unknown): RemoteShare {
	const raw = toRecord(payload)
	return {
		id: String(raw.id ?? ""),
		vaultId: String(raw.vault_id ?? ""),
		filePath: String(raw.file_path ?? ""),
		url: String(raw.url ?? ""),
		wrappedKey: String(raw.wrapped_key ?? ""),
		revision: typeof raw.revision === "number" ? raw.revision : 0,
		sizeBytes: typeof raw.size_bytes === "number" ? raw.size_bytes : 0,
		expiresAt: optionalString(raw.expires_at),
		createdBy: String(raw.created_by ?? ""),
		createdAt: String(raw.created_at ?? ""),
		updatedAt: String(raw.updated_at ?? ""),
	}
}

export async function listShares(api: ApiClient, vaultId: string): Promise<RemoteShare[]> {
	return toItems(
		await api.json<unknown>("GET", sharesPath(vaultId, "/"), "List shared notes"),
		"shares",
	).map(mapShare)
}

export async function createShare(
	api: ApiClient,
	vaultId: string,
	filePath: string,
	wrappedKey: string,
	expiresAt: string | null,
): Promise<RemoteShare> {
	return mapShare(
		await api.json<unknown>("POST", sharesPath(vaultId, "/"), "Share note", {
			json: { file_path: filePath, wrapped_key: wrappedKey, expires_at: expiresAt },
		}),
	)
}

export async function publishShareContent(
	api: ApiClient,
	vaultId: string,
	shareId: string,
	content: Uint8Array,
): Promise<RemoteShare> {
	return mapShare(
		await api.json<unknown>(
			"PUT",
			sharesPath(vaultId, `/${segment(shareId)}/content`),
			"Publish shared note",
			{
				body: content,
				headers: { "Content-Type": "application/octet-stream" },
			},
		),
	)
}

export async function updateShareExpiry(
	api: ApiClient,
	vaultId: string,
	shareId: string,
	expiresAt: string | null,
): Promise<RemoteShare> {
	return mapShare(
		await api.json<unknown>(
			"PATCH",
			sharesPath(vaultId, `/${segment(shareId)}`),
			"Update shared note",
			{
				json: { expires_at: expiresAt },
			},
		),
	)
}

export async function revokeShare(api: ApiClient, vaultId: string, shareId: string): Promise<void> {
	await api.send("DELETE", sharesPath(vaultId, `/${segment(shareId)}`), "Stop sharing note")
}

export async function fetchSharedContent(api: ApiClient, shareId: string): Promise<Uint8Array> {
	const response = await api.request("GET", `/share/v1/${segment(shareId)}`)
	await expectOk(response, "Open shared note")
	return new Uint8Array(await response.arrayBuffer())
}
