import type {
	TemplateShareAudience,
	TemplateShareKind,
	TemplateShareStatus,
} from "@cortex/platform"
import type { ApiClient } from "./client"
import { segment } from "./client"
import { optionalString, toItems, toRecord } from "./mappers"

export interface RemoteTemplateShare {
	id: string
	vaultId: string
	kind: TemplateShareKind
	audience: TemplateShareAudience
	groupId: string | null
	groupName: string | null
	ownerId: string
	ownerName: string
	name: string
	description: string
	includeSamples: boolean
	encrypted: boolean
	version: number
	status: TemplateShareStatus
	reviewNote: string
	slug: string
	url: string | null
	createdAt: string
	updatedAt: string
}

export interface RemotePublicTemplate {
	slug: string
	kind: TemplateShareKind
	name: string
	description: string
	ownerName: string
	version: number
	fileCount: number
	updatedAt: string
}

export interface RemoteTemplatePayload {
	payload: Uint8Array
	encrypted: boolean
	version: number
}

export interface CreateTemplateShareBody {
	kind: TemplateShareKind
	audience: TemplateShareAudience
	groupId: string | null
	name: string
	description: string
	includeSamples: boolean
	payload: Uint8Array
	encrypted: boolean
}

export interface UpdateTemplateShareBody {
	audience?: TemplateShareAudience
	groupId?: string | null
	name?: string
	description?: string
	includeSamples?: boolean
	payload?: Uint8Array
	encrypted?: boolean
}

function templatesPath(vaultId: string, suffix = ""): string {
	return `/sync/v1/vaults/${segment(vaultId)}/templates${suffix}`
}

function toBase64(bytes: Uint8Array): string {
	let binary = ""
	for (const byte of bytes) binary += String.fromCharCode(byte)
	return btoa(binary)
}

function fromBase64(value: unknown): Uint8Array {
	if (typeof value !== "string") return new Uint8Array()
	const binary = atob(value)
	const bytes = new Uint8Array(binary.length)
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
	return bytes
}

function toKind(value: unknown): TemplateShareKind {
	return value === "database" ? "database" : "note"
}

function toAudience(value: unknown): TemplateShareAudience {
	return value === "link" || value === "market" ? value : "team"
}

function toStatus(value: unknown): TemplateShareStatus {
	return value === "pending_review" || value === "rejected" ? value : "published"
}

function toNumber(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0
}

export function mapTemplateShare(payload: unknown): RemoteTemplateShare {
	const raw = toRecord(payload)
	return {
		id: String(raw.id ?? ""),
		vaultId: String(raw.vault_id ?? ""),
		kind: toKind(raw.kind),
		audience: toAudience(raw.audience),
		groupId: optionalString(raw.group_id),
		groupName: optionalString(raw.group_name),
		ownerId: String(raw.owner_id ?? ""),
		ownerName: String(raw.owner_name ?? ""),
		name: String(raw.name ?? ""),
		description: String(raw.description ?? ""),
		includeSamples: raw.include_samples === true,
		encrypted: raw.encrypted === true,
		version: toNumber(raw.version),
		status: toStatus(raw.status),
		reviewNote: String(raw.review_note ?? ""),
		slug: String(raw.slug ?? ""),
		url: optionalString(raw.url),
		createdAt: String(raw.created_at ?? ""),
		updatedAt: String(raw.updated_at ?? ""),
	}
}

export function mapPublicTemplate(payload: unknown): RemotePublicTemplate {
	const raw = toRecord(payload)
	return {
		slug: String(raw.slug ?? ""),
		kind: toKind(raw.kind),
		name: String(raw.name ?? ""),
		description: String(raw.description ?? ""),
		ownerName: String(raw.owner_name ?? ""),
		version: toNumber(raw.version),
		fileCount: toNumber(raw.file_count),
		updatedAt: String(raw.updated_at ?? ""),
	}
}

export async function listTemplateShares(
	api: ApiClient,
	vaultId: string,
): Promise<RemoteTemplateShare[]> {
	return toItems(
		await api.json<unknown>("GET", templatesPath(vaultId, "/"), "List shared templates"),
		"templates",
	).map(mapTemplateShare)
}

export async function createTemplateShare(
	api: ApiClient,
	vaultId: string,
	body: CreateTemplateShareBody,
): Promise<RemoteTemplateShare> {
	return mapTemplateShare(
		await api.json<unknown>("POST", templatesPath(vaultId, "/"), "Share template", {
			json: {
				kind: body.kind,
				audience: body.audience,
				group_id: body.groupId,
				name: body.name,
				description: body.description,
				include_samples: body.includeSamples,
				payload: toBase64(body.payload),
				encrypted: body.encrypted,
			},
		}),
	)
}

export async function updateTemplateShare(
	api: ApiClient,
	vaultId: string,
	templateId: string,
	body: UpdateTemplateShareBody,
): Promise<RemoteTemplateShare> {
	const json: Record<string, unknown> = {}
	if (body.audience !== undefined) json.audience = body.audience
	if (body.groupId !== undefined) json.group_id = body.groupId
	if (body.name !== undefined) json.name = body.name
	if (body.description !== undefined) json.description = body.description
	if (body.includeSamples !== undefined) json.include_samples = body.includeSamples
	if (body.payload !== undefined) {
		json.payload = toBase64(body.payload)
		json.encrypted = body.encrypted === true
	}
	return mapTemplateShare(
		await api.json<unknown>(
			"PATCH",
			templatesPath(vaultId, `/${segment(templateId)}`),
			"Update shared template",
			{ json },
		),
	)
}

export async function publishTemplatePayload(
	api: ApiClient,
	vaultId: string,
	templateId: string,
	payload: Uint8Array,
	encrypted: boolean,
): Promise<RemoteTemplateShare> {
	return mapTemplateShare(
		await api.json<unknown>(
			"PUT",
			templatesPath(vaultId, `/${segment(templateId)}/payload`),
			"Update shared template",
			{ json: { payload: toBase64(payload), encrypted } },
		),
	)
}

export async function fetchTemplatePayload(
	api: ApiClient,
	vaultId: string,
	templateId: string,
): Promise<RemoteTemplatePayload> {
	const raw = toRecord(
		await api.json<unknown>(
			"GET",
			templatesPath(vaultId, `/${segment(templateId)}/payload`),
			"Open shared template",
		),
	)
	return {
		payload: fromBase64(raw.payload),
		encrypted: raw.encrypted === true,
		version: toNumber(raw.version),
	}
}

export async function revokeTemplateShare(
	api: ApiClient,
	vaultId: string,
	templateId: string,
): Promise<void> {
	await api.send(
		"DELETE",
		templatesPath(vaultId, `/${segment(templateId)}`),
		"Stop sharing template",
	)
}

export async function listMarketTemplates(
	api: ApiClient,
	query: { kind?: TemplateShareKind; text?: string },
): Promise<RemotePublicTemplate[]> {
	const params = new URLSearchParams()
	if (query.kind) params.set("kind", query.kind)
	if (query.text?.trim()) params.set("q", query.text.trim())
	const suffix = params.size > 0 ? `?${params.toString()}` : ""
	return toItems(
		await api.json<unknown>("GET", `/template/v1/market${suffix}`, "Load templates"),
		"templates",
	).map(mapPublicTemplate)
}

export async function fetchPublicTemplate(
	api: ApiClient,
	slug: string,
): Promise<{ template: RemotePublicTemplate; payload: Uint8Array }> {
	const raw = toRecord(
		await api.json<unknown>("GET", `/template/v1/${segment(slug)}`, "Open template"),
	)
	return { template: mapPublicTemplate(raw.template), payload: fromBase64(raw.payload) }
}
