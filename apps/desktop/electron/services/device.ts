import { hostname } from "node:os"
import { randomUUID } from "node:crypto"
import * as keychain from "./keychain"

const DEVICE_ID_KEY = "device_id"

export interface DeviceInfo {
	deviceId: string
	deviceName: string
	deviceType: string
}

export function getDeviceId(): string {
	const existing = keychain.get(DEVICE_ID_KEY)
	if (existing) return existing
	const id = randomUUID()
	keychain.set(DEVICE_ID_KEY, id)
	return id
}

export function getDeviceInfo(): DeviceInfo {
	return {
		deviceId: getDeviceId(),
		deviceName: hostname(),
		deviceType: "desktop",
	}
}
