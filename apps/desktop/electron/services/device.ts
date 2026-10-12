import { randomUUID } from "node:crypto"
import { hostname } from "node:os"
import type { DeviceInfo } from "@cortex/platform"
import { DEVICE_ID_KEY, getOrCreateDeviceId } from "@cortex/platform/vault"
import type { MainApi } from "../contract"
import { get as getSecret, set as setSecret } from "./keychain"

export function getDeviceId(): string {
	return getOrCreateDeviceId({ get: getSecret, set: setSecret }, randomUUID)
}

export function getDeviceInfo(): DeviceInfo {
	return { deviceId: getDeviceId(), deviceName: hostname(), deviceType: "desktop" }
}

export function resetDeviceId(): DeviceInfo {
	setSecret(DEVICE_ID_KEY, randomUUID())
	return getDeviceInfo()
}

export const deviceApi = {
	getDeviceId: async () => getDeviceId(),
	getDeviceInfo: async () => getDeviceInfo(),
} satisfies MainApi["device"]
