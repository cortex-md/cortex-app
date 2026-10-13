import type { SyncLogEntry } from "@cortex/core"
import { Platform } from "react-native"

export const DEVICE_LABEL = Platform.OS === "ios" ? "iPhone" : "phone"

export const CURRENT_DEVICE_NAME = Platform.OS === "ios" ? "iPhone" : "Pixel"

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

export const FIXTURE_LINKED_REMOTE_VAULT: LinkedRemoteVault = {
	id: "remote-work",
	name: "Work",
	serverLabel: "Cortex Cloud",
	role: "Owner",
	memberCount: 4,
}

export const FIXTURE_REMOTE_VAULTS: LinkedRemoteVault[] = [
	FIXTURE_LINKED_REMOTE_VAULT,
	{
		id: "remote-design",
		name: "Design",
		serverLabel: "Cortex Cloud",
		role: "Viewer",
		memberCount: 7,
	},
	{
		id: "remote-family",
		name: "Family",
		serverLabel: "Cortex Cloud",
		role: "Owner",
		memberCount: 2,
	},
]

export const FIXTURE_REMOTE_VAULT_OPTIONS: RemoteVaultLinkOption[] = [
	{
		id: "remote-work",
		name: "Work",
		description: `4 members · Owner · linked to "Work" on this ${DEVICE_LABEL}`,
		encrypted: true,
		taken: true,
		isNew: false,
	},
	{
		id: "remote-design",
		name: "Design",
		description: "7 members · Viewer",
		encrypted: true,
		taken: false,
		isNew: false,
	},
	{
		id: "remote-family",
		name: "Family",
		description: "2 members · Owner",
		encrypted: true,
		taken: false,
		isNew: false,
	},
	{
		id: NEW_REMOTE_VAULT_OPTION_ID,
		name: "New remote vault",
		description: "Create it on Cortex Cloud and upload this vault",
		encrypted: false,
		taken: false,
		isNew: true,
	},
]

export const FIXTURE_SYNC_DEVICES: SyncDevice[] = [
	{
		id: "device-current",
		name: CURRENT_DEVICE_NAME,
		lastSyncedLabel: "Synced just now",
		isCurrent: true,
	},
	{ id: "device-macbook", name: "MacBook Pro", lastSyncedLabel: "2 hours ago", isCurrent: false },
]

export const FIXTURE_EXCLUDED_PATHS: ExcludedPathEntry[] = [
	{ value: "Archive", kind: "Folder" },
	{ value: "Private/journal.md", kind: "File" },
	{ value: "*.pdf", kind: "Pattern" },
]

const MINUTE_MS = 60_000

export function createFixtureSyncLogEntries(now: number): SyncLogEntry[] {
	return [
		{
			id: -1,
			timestamp: now - 150 * MINUTE_MS,
			level: "info",
			message: "Connected to Cortex Cloud",
			metadata: { path: "Work" },
		},
		{
			id: -2,
			timestamp: now - 149 * MINUTE_MS,
			level: "warn",
			message: "Retrying upload (attempt 2)",
			metadata: { path: "Reading/Clippings.md" },
		},
		{ id: -3, timestamp: now - 62_000, level: "info", message: "Pulled: Reading/Clippings.md" },
		{ id: -4, timestamp: now - 61_000, level: "info", message: "Pulled: Reading/Articles.md" },
		{ id: -5, timestamp: now - 60_000, level: "info", message: "Pulled: Daily/2026-10-11.md" },
		{
			id: -6,
			timestamp: now - 50_000,
			level: "error",
			message: "Conflict detected: Projects/Cortex/Sync engine notes.md",
		},
		{
			id: -7,
			timestamp: now - 4_000,
			level: "info",
			message: "Pushed: Projects/Cortex/Roadmap.md",
		},
		{ id: -8, timestamp: now - 3_000, level: "info", message: "Pushed: Inbox.md" },
	]
}
