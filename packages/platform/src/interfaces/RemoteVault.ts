export interface RemoteVaultInfo {
	id: string
	name: string
	description: string | null
	ownerId: string
	role: string
	memberCount: number
	createdAt: string
	updatedAt: string
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
	delete(vaultId: string): Promise<void>
	link(vaultPath: string, remoteVaultId: string): Promise<void>
	unlink(vaultPath: string): Promise<void>
	getLink(vaultPath: string): Promise<string | null>
	readSyncConfig(vaultPath: string): Promise<SyncConfig>
	updateSyncConfig(vaultPath: string, key: string, value: unknown): Promise<void>
}
