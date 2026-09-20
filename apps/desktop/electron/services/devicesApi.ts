import * as http from "./httpClient"

export interface DeviceEntry {
	id: string
	deviceName: string
	deviceType: string
	lastSeenAt: string | null
	createdAt: string
	revoked: boolean
	isCurrent: boolean | null
	lastSyncEventId: number | null
}

interface DeviceResponse {
	id: string
	device_name: string
	device_type: string
	last_seen_at?: string | null
	created_at: string
	revoked: boolean
	is_current?: boolean | null
	last_sync_event_id?: number | null
}

function mapDevice(raw: DeviceResponse): DeviceEntry {
	return {
		id: raw.id,
		deviceName: raw.device_name,
		deviceType: raw.device_type,
		lastSeenAt: raw.last_seen_at ?? null,
		createdAt: raw.created_at,
		revoked: raw.revoked,
		isCurrent: raw.is_current ?? null,
		lastSyncEventId: raw.last_sync_event_id ?? null,
	}
}

export async function devicesList(): Promise<DeviceEntry[]> {
	const response = await http.get("/devices/v1/")
	const raw = await http.parseResponse<DeviceResponse[]>(response)
	return raw.map(mapDevice)
}

export async function deviceGet(deviceId: string): Promise<DeviceEntry> {
	const response = await http.get(`/devices/v1/${deviceId}`)
	const raw = await http.parseResponse<DeviceResponse>(response)
	return mapDevice(raw)
}

export async function deviceRename(deviceId: string, deviceName: string): Promise<DeviceEntry> {
	const response = await http.patchJson(`/devices/v1/${deviceId}`, {
		device_name: deviceName,
	})
	const raw = await http.parseResponse<DeviceResponse>(response)
	return mapDevice(raw)
}

export async function deviceRevoke(deviceId: string): Promise<void> {
	const response = await http.deleteRequest(`/devices/v1/${deviceId}`)
	if (!response.ok) {
		const body = await response.text().catch(() => "")
		throw new Error(`HTTP ${response.status}: ${body}`)
	}
}

export async function deviceUpdateSyncCursor(
	deviceId: string,
	lastSyncEventId: number,
): Promise<void> {
	const response = await http.putJson(`/devices/v1/${deviceId}/sync-cursor`, {
		last_sync_event_id: lastSyncEventId,
	})
	if (!response.ok) {
		const body = await response.text().catch(() => "")
		throw new Error(`HTTP ${response.status}: ${body}`)
	}
}
