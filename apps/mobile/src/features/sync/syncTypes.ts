import { Platform } from "react-native"

export const DEVICE_LABEL = Platform.OS === "ios" ? "iPhone" : "phone"

export const CURRENT_DEVICE_NAME = Platform.OS === "ios" ? "iPhone" : "Android"

export interface RemoteVaultLinkOption {
	id: string
	name: string
	description: string
	encrypted: boolean
	taken: boolean
	isNew: boolean
}

export interface SyncDevice {
	id: string
	name: string
	lastSyncedLabel: string
	isCurrent: boolean
}

export interface LinkedRemoteVault {
	id: string
	name: string
	serverLabel: string
	role: string
	memberCount: number
}

export interface ExcludedPathEntry {
	value: string
	kind: "Folder" | "File" | "Pattern"
}

export const NEW_REMOTE_VAULT_OPTION_ID = "new"

export const NEW_REMOTE_VAULT_OPTION: RemoteVaultLinkOption = {
	id: NEW_REMOTE_VAULT_OPTION_ID,
	name: "New remote vault",
	description: "Create it on Cortex Cloud and upload this vault",
	encrypted: false,
	taken: false,
	isNew: true,
}
