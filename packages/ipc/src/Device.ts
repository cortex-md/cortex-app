import type { DeviceInfo, Device as IDevice } from "@cortex/platform"
import { invoke } from "@tauri-apps/api/core"

export class Device implements IDevice {
	async getDeviceId(): Promise<string> {
		return await invoke<string>("get_device_id")
	}

	async getDeviceInfo(): Promise<DeviceInfo> {
		return await invoke<DeviceInfo>("get_device_info")
	}
}
