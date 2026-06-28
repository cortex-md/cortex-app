export interface DeviceInfo {
	deviceId: string
	deviceName: string
	deviceType: string
}

export interface Device {
	getDeviceId(): Promise<string>
	getDeviceInfo(): Promise<DeviceInfo>
}
