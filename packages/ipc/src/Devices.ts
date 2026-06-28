import type { DeviceEntry, Devices as IDevices } from "@cortex/platform"
import { invoke } from "@tauri-apps/api/core"

export class Devices implements IDevices {
	async list(): Promise<DeviceEntry[]> {
		return await invoke<DeviceEntry[]>("devices_list")
	}

	async get(deviceId: string): Promise<DeviceEntry> {
		return await invoke<DeviceEntry>("device_get", { deviceId })
	}

	async rename(deviceId: string, deviceName: string): Promise<DeviceEntry> {
		return await invoke<DeviceEntry>("device_rename", { deviceId, deviceName })
	}

	async revoke(deviceId: string): Promise<void> {
		await invoke<void>("device_revoke", { deviceId })
	}

	async updateSyncCursor(deviceId: string, lastSyncEventId: number): Promise<void> {
		await invoke<void>("device_update_sync_cursor", { deviceId, lastSyncEventId })
	}
}
