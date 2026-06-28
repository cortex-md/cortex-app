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

export interface Devices {
	list(): Promise<DeviceEntry[]>
	get(deviceId: string): Promise<DeviceEntry>
	rename(deviceId: string, deviceName: string): Promise<DeviceEntry>
	revoke(deviceId: string): Promise<void>
	updateSyncCursor(deviceId: string, lastSyncEventId: number): Promise<void>
}
