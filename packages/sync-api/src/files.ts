import type { DeletedFileInfo, VersionInfo } from "@cortex/platform"
import { type ApiClient, segment, withQuery } from "./client"
import { expectOk, SyncError } from "./errors"

export interface RemoteFileInfo {
	path: string
	checksum: string | null
	version: number
	snapshotId: string | null
	deleted: boolean
	sizeBytes: number | null
	contentType: string | null
	createdAt: string | null
	updatedAt: string | null
	lastModifiedBy: string | null
	lastDeviceId: string | null
	createdBy: string | null
}

export interface RemoteFileIndex {
	files: RemoteFileInfo[]
	latestEventId: string | null
}

export interface BatchItem {
	path: string
	version?: number
}

export type BatchItemStatus = "ok" | "not_found" | "forbidden" | "error"

export interface BatchFrame {
	path: string
	version: number
	status: BatchItemStatus
	snapshotId: string | null
	checksum: string | null
	sizeBytes: number
	createdBy: string | null
	createdAt: string | null
	body: Uint8Array
}

export interface RemoteChange {
	id: string | null
	type: string
	path: string
	oldPath: string | null
	version: number
	actorId: string
	deviceId: string
	createdAt: string | null
}

export interface UploadResult {
	snapshotId: string | null
	version: number
	createdBy: string | null
	createdAt: string | null
	updatedAt: string | null
	lastModifiedBy: string | null
	lastDeviceId: string | null
}

interface RemoteFileResponse {
	file_path: string
	checksum?: string | null
	version: number
	snapshot_id?: string | null
	deleted?: boolean | null
	size_bytes?: number | null
	content_type?: string | null
	created_at?: string | null
	updated_at?: string | null
	last_modified_by?: string | null
	last_device_id?: string | null
	created_by?: string | null
}

interface FileWriteResponse {
	snapshot_id?: string | null
	version: number
	created_by?: string | null
	created_at?: string | null
	updated_at?: string | null
	last_modified_by?: string | null
	last_device_id?: string | null
}

interface VersionResponse {
	snapshot_id: string
	version: number
	size_bytes?: number | null
	checksum?: string | null
	author_id?: string | null
	author_name?: string | null
	author_avatar_url?: string | null
	device_id?: string | null
	device_name?: string | null
	created_at?: string | null
}

export interface RemoteChangeResponse {
	id?: number | string | null
	event_type?: string
	file_path: string
	version: number
	actor_id: string
	device_id: string
	created_at?: string | null
	old_path?: string | null
	metadata?: { old_path?: string | null } | null
}

function filesPath(vaultId: string, suffix = ""): string {
	return `/sync/v1/vaults/${segment(vaultId)}/files${suffix}`
}

function mapRemoteFile(raw: RemoteFileResponse): RemoteFileInfo {
	return {
		path: raw.file_path,
		checksum: raw.checksum ?? null,
		version: raw.version,
		snapshotId: raw.snapshot_id ?? null,
		deleted: raw.deleted ?? false,
		sizeBytes: raw.size_bytes ?? null,
		contentType: raw.content_type ?? null,
		createdAt: raw.created_at ?? null,
		updatedAt: raw.updated_at ?? null,
		lastModifiedBy: raw.last_modified_by ?? null,
		lastDeviceId: raw.last_device_id ?? null,
		createdBy: raw.created_by ?? null,
	}
}

function mapWriteResult(raw: FileWriteResponse): UploadResult {
	return {
		snapshotId: raw.snapshot_id ?? null,
		version: raw.version,
		createdBy: raw.created_by ?? null,
		createdAt: raw.created_at ?? null,
		updatedAt: raw.updated_at ?? null,
		lastModifiedBy: raw.last_modified_by ?? null,
		lastDeviceId: raw.last_device_id ?? null,
	}
}

export function mapRemoteChange(
	raw: RemoteChangeResponse,
	type = raw.event_type ?? "",
): RemoteChange {
	return {
		id: raw.id === null || raw.id === undefined || raw.id === "" ? null : String(raw.id),
		type,
		path: raw.file_path,
		oldPath: raw.old_path ?? raw.metadata?.old_path ?? null,
		version: raw.version,
		actorId: raw.actor_id,
		deviceId: raw.device_id,
		createdAt: raw.created_at ?? null,
	}
}

export async function listFileIndex(
	api: ApiClient,
	vaultId: string,
	includeDeleted = false,
): Promise<RemoteFileIndex> {
	const path = withQuery(filesPath(vaultId, "/list"), {
		include_deleted: includeDeleted ? true : null,
	})
	const response = await api.send("GET", path, "List remote files")
	const raw = (await response.json()) as RemoteFileResponse[]
	return {
		files: raw.map(mapRemoteFile),
		latestEventId: response.headers.get("X-Latest-Event-ID"),
	}
}

export async function fileInfo(
	api: ApiClient,
	vaultId: string,
	path: string,
): Promise<RemoteFileInfo | null> {
	const response = await api.request("GET", withQuery(filesPath(vaultId, "/info"), { path }))
	if (response.status === 404) return null
	await expectOk(response, `File info ${path}`)
	return mapRemoteFile((await response.json()) as RemoteFileResponse)
}

export async function listDeletedFiles(
	api: ApiClient,
	vaultId: string,
): Promise<DeletedFileInfo[]> {
	return (await listFileIndex(api, vaultId, true)).files
		.filter((file) => file.deleted)
		.map((file) => ({
			filePath: file.path,
			version: file.version,
			sizeBytes: file.sizeBytes,
			checksum: file.checksum,
			contentType: file.contentType,
			deletedAt: file.updatedAt,
			lastModifiedBy: file.lastModifiedBy,
			lastDeviceId: file.lastDeviceId,
		}))
}

export interface DownloadedFile {
	bytes: Uint8Array
	version: number
}

export async function downloadFile(
	api: ApiClient,
	vaultId: string,
	path: string,
	version: number | null = null,
): Promise<DownloadedFile> {
	const response = await api.send(
		"GET",
		withQuery(filesPath(vaultId), { path, version }),
		`Download ${path}`,
	)
	return {
		bytes: new Uint8Array(await response.arrayBuffer()),
		version: Number(response.headers.get("X-File-Version")),
	}
}

export async function uploadFile(
	api: ApiClient,
	vaultId: string,
	path: string,
	hash: string,
	encrypted: Uint8Array,
	baseVersion: number | null = null,
): Promise<UploadResult> {
	const headers: Record<string, string> = {
		"X-File-Path": encodeURIComponent(path),
		"X-File-Path-Encoding": "uri",
		"X-Local-Hash": hash,
		"Content-Type": "application/octet-stream",
	}
	if (baseVersion !== null) headers["X-Base-Version"] = String(baseVersion)
	const raw = await api.json<FileWriteResponse>("POST", filesPath(vaultId), `Upload ${path}`, {
		body: encrypted,
		headers,
	})
	return mapWriteResult(raw)
}

export function isVersionConflict(error: unknown): boolean {
	return error instanceof SyncError && error.status === 409 && error.code === "conflict"
}

interface BatchFrameHeader {
	path: string
	version: number
	status: BatchItemStatus
	snapshot_id?: string
	checksum?: string
	size_bytes?: number
	created_by?: string
	created_at?: string
}

class ByteQueue {
	private chunks: Uint8Array[] = []
	private offset = 0
	length = 0

	push(chunk: Uint8Array): void {
		this.chunks.push(chunk)
		this.length += chunk.length
	}

	take(size: number): Uint8Array {
		const out = new Uint8Array(size)
		let written = 0
		while (written < size) {
			const head = this.chunks[0] as Uint8Array
			const available = head.length - this.offset
			const count = Math.min(available, size - written)
			out.set(head.subarray(this.offset, this.offset + count), written)
			written += count
			this.offset += count
			if (this.offset === head.length) {
				this.chunks.shift()
				this.offset = 0
			}
		}
		this.length -= size
		return out
	}
}

const textDecoder = new TextDecoder()

export async function downloadBatch(
	api: ApiClient,
	vaultId: string,
	items: BatchItem[],
	onFrame: (frame: BatchFrame) => Promise<void> | void,
): Promise<void> {
	const response = await api.send("POST", filesPath(vaultId, "/batch"), "Batch download", {
		json: { items: items.map((item) => ({ path: item.path, version: item.version ?? 0 })) },
	})
	const reader = response.body?.getReader()
	if (!reader) throw new Error("Batch download returned no body")
	const queue = new ByteQueue()
	let header: BatchFrameHeader | null = null
	let bodyLength: number | null = null
	let headerLength: number | null = null

	const parse = async (): Promise<void> => {
		for (;;) {
			if (headerLength === null) {
				if (queue.length < 4) return
				headerLength = new DataView(queue.take(4).buffer).getUint32(0)
			}
			if (header === null) {
				if (queue.length < headerLength) return
				header = JSON.parse(textDecoder.decode(queue.take(headerLength))) as BatchFrameHeader
			}
			if (bodyLength === null) {
				if (queue.length < 8) return
				bodyLength = Number(new DataView(queue.take(8).buffer).getBigUint64(0))
			}
			if (queue.length < bodyLength) return
			const body = queue.take(bodyLength)
			const frame: BatchFrame = {
				path: header.path,
				version: header.version,
				status: header.status,
				snapshotId: header.snapshot_id ?? null,
				checksum: header.checksum ?? null,
				sizeBytes: header.size_bytes ?? body.length,
				createdBy: header.created_by ?? null,
				createdAt: header.created_at ?? null,
				body,
			}
			headerLength = null
			header = null
			bodyLength = null
			await onFrame(frame)
		}
	}

	for (;;) {
		const { done, value } = await reader.read()
		if (done) break
		queue.push(value)
		await parse()
	}
	if (headerLength !== null || queue.length > 0) throw new Error("Batch download truncated")
}

export async function updateVaultCursor(
	api: ApiClient,
	vaultId: string,
	lastEventId: number,
): Promise<void> {
	await api.send("PUT", `/sync/v1/vaults/${segment(vaultId)}/cursor`, "Update vault cursor", {
		json: { last_event_id: lastEventId },
	})
}

export async function deleteFile(
	api: ApiClient,
	vaultId: string,
	path: string,
	baseVersion: number | null = null,
): Promise<void> {
	const response = await api.request("DELETE", withQuery(filesPath(vaultId), { path }), {
		headers: baseVersion === null ? {} : { "X-Base-Version": String(baseVersion) },
	})
	if (response.status === 404) return
	await expectOk(response, `Delete ${path}`)
}

export async function renameFile(
	api: ApiClient,
	vaultId: string,
	oldPath: string,
	newPath: string,
): Promise<UploadResult> {
	const raw = await api.json<FileWriteResponse>(
		"POST",
		filesPath(vaultId, "/rename"),
		`Rename ${oldPath}`,
		{ json: { old_path: oldPath, new_path: newPath } },
	)
	return mapWriteResult(raw)
}

export async function restoreFile(api: ApiClient, vaultId: string, path: string): Promise<void> {
	await api.send("POST", withQuery(filesPath(vaultId, "/restore"), { path }), `Restore ${path}`, {
		json: {},
	})
}

export async function fileHistory(
	api: ApiClient,
	vaultId: string,
	path: string,
): Promise<VersionInfo[]> {
	const raw = await api.json<VersionResponse[]>(
		"GET",
		withQuery(filesPath(vaultId, "/history"), { path }),
		`Version history for ${path}`,
	)
	return raw.map((version) => ({
		snapshotId: version.snapshot_id,
		version: version.version,
		sizeBytes: version.size_bytes ?? null,
		checksum: version.checksum ?? null,
		authorId: version.author_id ?? null,
		authorName: version.author_name ?? null,
		authorAvatarUrl: version.author_avatar_url
			? `${api.serverUrl}${version.author_avatar_url}`
			: null,
		deviceId: version.device_id ?? null,
		deviceName: version.device_name ?? null,
		createdAt: version.created_at ?? null,
	}))
}

export async function listChanges(
	api: ApiClient,
	vaultId: string,
	since: string | null,
	limit: number,
): Promise<RemoteChange[]> {
	const raw = await api.json<RemoteChangeResponse[]>(
		"GET",
		withQuery(`/sync/v1/vaults/${segment(vaultId)}/changes`, { since, limit }),
		"List changes",
	)
	return raw.map((change) => mapRemoteChange(change))
}

export function eventsPath(vaultId: string): string {
	return `/sync/v1/vaults/${segment(vaultId)}/events`
}
