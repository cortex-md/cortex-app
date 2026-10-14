import type { Platform } from "@cortex/platform"
import { type DeviceIdStore, getOrCreateDeviceId } from "@cortex/platform/vault"
import * as Device from "expo-device"
import * as SecureStore from "expo-secure-store"
import { Platform as ReactNativePlatform } from "react-native"

import { toSecureStoreKey } from "./keychain"

const deviceIdStore: DeviceIdStore = {
	get: (key) => SecureStore.getItem(toSecureStoreKey(key)),
	set: (key, value) => SecureStore.setItem(toSecureStoreKey(key), value),
}

let cachedDeviceId: string | null = null

export function getDeviceId(): string {
	cachedDeviceId ??= getOrCreateDeviceId(deviceIdStore, () => crypto.randomUUID())
	return cachedDeviceId
}

function getDeviceTypeLabel(deviceType: Device.DeviceType | null): string {
	switch (deviceType) {
		case Device.DeviceType.PHONE:
			return "phone"
		case Device.DeviceType.TABLET:
			return "tablet"
		case Device.DeviceType.DESKTOP:
			return "desktop"
		case Device.DeviceType.TV:
			return "tv"
		default:
			return "unknown"
	}
}

export async function getDeviceInfo() {
	const deviceType = await Device.getDeviceTypeAsync().catch(() => Device.deviceType)
	const deviceName =
		Device.deviceName ?? Device.modelName ?? Device.brand ?? `${ReactNativePlatform.OS} device`

	return {
		deviceId: getDeviceId(),
		deviceName,
		deviceType: getDeviceTypeLabel(deviceType),
	}
}

export const deviceApi = {
	getDeviceId: async () => getDeviceId(),
	getDeviceInfo,
} satisfies Platform["device"]
