import type { DeviceEntry } from "./Devices"
import type { VaultInvite } from "./Members"
import type { RemoteVaultInfo } from "./RemoteVault"
import type { SubscriptionStatus } from "./Subscription"

export type TenancyMode = "single" | "multi"

export interface ServerFeatures {
	collab: boolean
	avatars: boolean
	guests: boolean
	publicLinks: boolean
	email: boolean
	emailVerification: boolean
	passwordReset: boolean
	subscription: boolean
	registrationMode: string
	vaultCreation: string
}

export interface ServerLimits {
	maxFileSize: number
	maxUploadBytes: number
	avatarMaxBytes: number
	batchMaxItems: number
	batchMaxBytes: number
}

export interface ServerCapabilities {
	version: string
	tenancyMode: TenancyMode
	features: ServerFeatures
	limits: ServerLimits
}

export interface AccountProfile {
	userId: string
	email: string
	displayName: string
	locale: string
	avatarUrl: string | null
	emailVerified: boolean
	hasPublicKey: boolean
	isInstanceAdmin: boolean
	createdAt: string
}

export interface KeyStatus {
	kdfVersion: number
	hasPublicKey: boolean
	hasLocalIdentity: boolean
	hasRecoveryKey: boolean
	fingerprint: string | null
}

export interface KeySetupResult {
	recoveryKey: string | null
}

export interface ProfileUpdate {
	displayName?: string
	locale?: string
}

export interface EmailChangeResult {
	applied: boolean
}

export interface DeviceVaultCursor {
	vaultId: string
	lastEventId: number
	syncedAt: string
}

export interface AccountDevice extends DeviceEntry {
	vaultCursors: DeviceVaultCursor[]
}

export interface AccountOverview {
	account: AccountProfile
	devices: AccountDevice[]
	vaults: RemoteVaultInfo[]
	invites: VaultInvite[]
	subscription: SubscriptionStatus | null
}

export interface Account {
	getCapabilities(serverUrl?: string): Promise<ServerCapabilities>
	getProfile(): Promise<AccountProfile>
	getOverview(): Promise<AccountOverview>
	updateProfile(update: ProfileUpdate): Promise<AccountProfile>
	changePassword(currentPassword: string, newPassword: string): Promise<void>
	requestEmailChange(password: string, newEmail: string): Promise<EmailChangeResult>
	resendEmailVerification(): Promise<void>
	setAvatar(image: Uint8Array, contentType: string): Promise<AccountProfile>
	deleteAvatar(): Promise<void>
	getKeyStatus(): Promise<KeyStatus>
	setupKeys(password: string): Promise<KeySetupResult>
	regenerateRecoveryKey(): Promise<string>
}
