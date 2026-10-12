export interface RemoteVaultInfo {
	id: string
	name: string
	description: string | null
	icon: string | null
	ownerId: string
	role: string
	memberCount: number | null
	hasKey: boolean
	allowedEmailDomains: string[]
	allowGuests: boolean
	allowPublicLinks: boolean
	storageUsedBytes: number
	storageQuotaBytes: number | null
	createdAt: string
	updatedAt: string
}

export interface RemoteVaultSettings {
	name?: string
	description?: string
	icon?: string
	allowedEmailDomains?: string[]
	allowGuests?: boolean
	allowPublicLinks?: boolean
	storageQuotaBytes?: number | null
}

export interface SyncConfig {
	enabled: boolean
	remoteVaultId: string | null
	selfHosted: boolean
	serverUrl: string | null
	offlineMode: boolean
	selfHostedEnvironment: Record<string, string>
}

export interface RemoteVault {
	create(name: string, description: string | null): Promise<RemoteVaultInfo>
	list(): Promise<RemoteVaultInfo[]>
	get(vaultId: string): Promise<RemoteVaultInfo>
	update(vaultId: string, name: string | null, description: string | null): Promise<RemoteVaultInfo>
	updateSettings(vaultId: string, settings: RemoteVaultSettings): Promise<RemoteVaultInfo>
	delete(vaultId: string): Promise<void>
}
