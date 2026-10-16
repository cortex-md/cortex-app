import type {
	AcceptInviteResult,
	AccessEntry,
	AccessLevel,
	AccessRule,
	AccountDevice,
	AccountOverview,
	AccountProfile,
	DeviceEntry,
	EffectiveAccess,
	EffectiveAccessLevel,
	InvitePreview,
	MemberDevice,
	PathGrant,
	RemoteVaultInfo,
	ServerCapabilities,
	SubscriptionStatus,
	SubscriptionStatusKind,
	VaultGroup,
	VaultInvite,
	VaultMember,
	VaultOverview,
} from "@cortex/platform"

type RawRecord = Record<string, unknown>

const SUBSCRIPTION_STATUS_KINDS: readonly SubscriptionStatusKind[] = [
	"active",
	"cancelled",
	"disabled",
	"expired",
	"none",
	"pending",
]

export function toRecord(value: unknown): RawRecord {
	return value && typeof value === "object" && !Array.isArray(value) ? (value as RawRecord) : {}
}

export function toItems(payload: unknown, key: string): unknown[] {
	if (Array.isArray(payload)) return payload
	const wrapped = toRecord(payload)[key]
	return Array.isArray(wrapped) ? wrapped : []
}

export function optionalString(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null
}

function requiredString(value: unknown, fallback = ""): string {
	return optionalString(value) ?? fallback
}

function optionalNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null
}

function stringList(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: []
}

export function absoluteUrl(serverUrl: string, value: unknown): string | null {
	const path = optionalString(value)
	if (!path) return null
	return /^https?:\/\//.test(path) ? path : `${serverUrl}${path}`
}

export function mapRemoteVault(payload: unknown): RemoteVaultInfo {
	const raw = toRecord(payload)
	return {
		id: requiredString(raw.id),
		name: requiredString(raw.name, "Untitled vault"),
		description: optionalString(raw.description),
		icon: optionalString(raw.icon),
		ownerId: requiredString(raw.owner_id),
		role: requiredString(raw.role, "unknown"),
		memberCount: optionalNumber(raw.member_count),
		hasKey: raw.has_key === true,
		allowedEmailDomains: stringList(raw.allowed_email_domains),
		allowGuests: raw.allow_guests !== false,
		allowPublicLinks: raw.allow_public_links !== false,
		storageUsedBytes: optionalNumber(raw.storage_used_bytes) ?? 0,
		storageQuotaBytes: optionalNumber(raw.storage_quota_bytes),
		createdAt: requiredString(raw.created_at),
		updatedAt: requiredString(raw.updated_at),
	}
}

export function mapRemoteVaults(payload: unknown): RemoteVaultInfo[] {
	return toItems(payload, "vaults").map(mapRemoteVault)
}

export function mapGrant(payload: unknown): PathGrant {
	const raw = toRecord(payload)
	return { path: requiredString(raw.path), canWrite: raw.can_write === true }
}

export function mapGrants(payload: unknown): PathGrant[] {
	return toItems(payload, "grants").map(mapGrant)
}

export function mapMember(payload: unknown, serverUrl = ""): VaultMember {
	const raw = toRecord(payload)
	return {
		vaultId: requiredString(raw.vault_id),
		userId: requiredString(raw.user_id),
		email: requiredString(raw.email),
		displayName: requiredString(raw.display_name),
		avatarUrl: absoluteUrl(serverUrl, raw.avatar_url),
		hasKey: raw.has_key === true,
		publicKey: optionalString(raw.public_key),
		role: requiredString(raw.role, "unknown"),
		joinedAt: requiredString(raw.joined_at),
	}
}

export function mapInvite(payload: unknown): VaultInvite {
	const raw = toRecord(payload)
	return {
		id: requiredString(raw.id),
		vaultId: requiredString(raw.vault_id),
		vaultName: requiredString(raw.vault_name),
		inviterId: requiredString(raw.inviter_id),
		inviterName: optionalString(raw.inviter_name),
		inviteeEmail: requiredString(raw.invitee_email),
		role: requiredString(raw.role, "unknown"),
		grants: mapGrants(raw.grants),
		encryptedVaultKey: optionalString(raw.encrypted_vault_key),
		inviteUrl: optionalString(raw.invite_url),
		accepted: raw.accepted === true,
		expiresAt: requiredString(raw.expires_at),
		createdAt: requiredString(raw.created_at),
	}
}

export function mapInvitePreview(payload: unknown): InvitePreview {
	const raw = toRecord(payload)
	return {
		vaultName: requiredString(raw.vault_name),
		inviterName: requiredString(raw.inviter_name),
		role: requiredString(raw.role, "unknown"),
		expiresAt: requiredString(raw.expires_at),
	}
}

export function mapAcceptedInvite(payload: unknown): AcceptInviteResult {
	const vault = mapRemoteVault(payload)
	return {
		id: vault.id,
		name: vault.name,
		description: vault.description,
		ownerId: vault.ownerId,
		role: vault.role,
		createdAt: vault.createdAt,
		updatedAt: vault.updatedAt,
	}
}

export function mapDevice(payload: unknown): DeviceEntry {
	const raw = toRecord(payload)
	return {
		id: requiredString(raw.id),
		deviceName: requiredString(raw.device_name, "Unnamed device"),
		deviceType: requiredString(raw.device_type, "unknown"),
		lastSeenAt: optionalString(raw.last_seen_at),
		createdAt: requiredString(raw.created_at),
		revoked: raw.revoked === true,
		isCurrent: typeof raw.is_current === "boolean" ? raw.is_current : null,
	}
}

export function mapDevices(payload: unknown): DeviceEntry[] {
	return toItems(payload, "devices").map(mapDevice)
}

export function mapAccountProfile(payload: unknown, serverUrl: string): AccountProfile {
	const raw = toRecord(payload)
	return {
		userId: requiredString(raw.id),
		email: requiredString(raw.email),
		displayName: requiredString(raw.display_name),
		locale: requiredString(raw.locale, "en"),
		avatarUrl: absoluteUrl(serverUrl, raw.avatar_url),
		emailVerified: raw.email_verified === true,
		hasPublicKey: raw.has_public_key === true,
		isInstanceAdmin: raw.is_instance_admin === true,
		createdAt: requiredString(raw.created_at),
	}
}

export function mapCapabilities(payload: unknown): ServerCapabilities {
	const raw = toRecord(payload)
	const features = toRecord(raw.features)
	const limits = toRecord(raw.limits)
	return {
		version: requiredString(raw.version, "unknown"),
		tenancyMode: raw.tenancy_mode === "multi" ? "multi" : "single",
		features: {
			collab: features.collab === true,
			avatars: features.avatars === true,
			guests: features.guests === true,
			publicLinks: features.public_links === true,
			email: features.email === true,
			emailVerification: features.email_verification === true,
			passwordReset: features.password_reset === true,
			subscription: features.subscription === true,
			registrationMode: requiredString(features.registration_mode, "open"),
			vaultCreation: requiredString(features.vault_creation, "everyone"),
		},
		limits: {
			maxFileSize: optionalNumber(limits.max_file_size) ?? 0,
			maxUploadBytes: optionalNumber(limits.max_upload_bytes) ?? 0,
			avatarMaxBytes: optionalNumber(limits.avatar_max_bytes) ?? 0,
			batchMaxItems: optionalNumber(limits.batch_max_items) ?? 0,
			batchMaxBytes: optionalNumber(limits.batch_max_bytes) ?? 0,
			maxConcurrentUploads: optionalNumber(limits.max_concurrent_uploads_per_user) ?? 0,
		},
	}
}

function mapAccountDevice(payload: unknown): AccountDevice {
	const raw = toRecord(payload)
	return {
		...mapDevice(payload),
		vaultCursors: toItems(raw.vault_cursors, "vault_cursors").map((cursor) => {
			const entry = toRecord(cursor)
			return {
				vaultId: requiredString(entry.vault_id),
				lastEventId: optionalNumber(entry.last_event_id) ?? 0,
				syncedAt: requiredString(entry.synced_at),
			}
		}),
	}
}

export function mapAccountOverview(payload: unknown, serverUrl: string): AccountOverview {
	const raw = toRecord(payload)
	return {
		account: mapAccountProfile(raw.account, serverUrl),
		devices: toItems(raw.devices, "devices").map(mapAccountDevice),
		vaults: mapRemoteVaults(raw.vaults),
		invites: toItems(raw.invites, "invites").map(mapInvite),
		subscription: raw.subscription ? mapSubscriptionStatus(raw.subscription) : null,
	}
}

function mapMemberDevice(payload: unknown): MemberDevice {
	const raw = toRecord(payload)
	return {
		id: requiredString(raw.id),
		userId: requiredString(raw.user_id),
		deviceName: requiredString(raw.device_name, "Unnamed device"),
		deviceType: requiredString(raw.device_type, "unknown"),
		lastSeenAt: requiredString(raw.last_seen_at),
		syncedAt: optionalString(raw.synced_at),
	}
}

function mapAccessLevel(value: unknown): AccessLevel {
	return value === "edit" ? "edit" : "view"
}

function mapEffectiveLevel(value: unknown): EffectiveAccessLevel {
	return value === "edit" || value === "view" ? value : "none"
}

export function mapGroup(payload: unknown): VaultGroup {
	const raw = toRecord(payload)
	return {
		id: requiredString(raw.id),
		name: requiredString(raw.name),
		memberIds: stringList(raw.member_ids),
		createdAt: requiredString(raw.created_at),
	}
}

export function mapGroups(payload: unknown): VaultGroup[] {
	return toItems(payload, "groups").map(mapGroup)
}

function mapAccessEntry(payload: unknown): AccessEntry {
	const raw = toRecord(payload)
	return {
		principalType: raw.principal_type === "group" ? "group" : "user",
		principalId: requiredString(raw.principal_id),
		level: mapAccessLevel(raw.level),
	}
}

export function mapAccessRule(payload: unknown): AccessRule {
	const raw = toRecord(payload)
	return {
		path: requiredString(raw.path),
		restricted: raw.restricted === true,
		entries: toItems(raw.entries, "entries").map(mapAccessEntry),
	}
}

export function mapAccessRules(payload: unknown): AccessRule[] {
	return toItems(payload, "rules").map(mapAccessRule)
}

const ROLE_BASE_ACCESS: Record<string, EffectiveAccessLevel> = {
	editor: "edit",
	viewer: "view",
}

export function roleAccess(role: string): EffectiveAccess {
	const all = role === "owner" || role === "admin"
	return { all, base: all ? "edit" : (ROLE_BASE_ACCESS[role] ?? "none"), rules: [] }
}

export function mapEffectiveAccess(payload: unknown, role = "unknown"): EffectiveAccess {
	if (!payload || typeof payload !== "object") return roleAccess(role)
	const raw = toRecord(payload)
	return {
		all: raw.all === true,
		base: mapEffectiveLevel(raw.base),
		rules: toItems(raw.rules, "rules").map((rule) => {
			const entry = toRecord(rule)
			return { path: requiredString(entry.path), level: mapEffectiveLevel(entry.level) }
		}),
	}
}

export function mapVaultOverview(payload: unknown, serverUrl: string): VaultOverview {
	const raw = toRecord(payload)
	const myRole = requiredString(raw.my_role, "unknown")
	return {
		vault: mapRemoteVault(raw.vault),
		myRole,
		myAccess: mapEffectiveAccess(raw.my_access, myRole),
		members: toItems(raw.members, "members").map((member) => mapMember(member, serverUrl)),
		groups: mapGroups(raw.groups),
		accessRules: mapAccessRules(raw.access_rules),
		invites: toItems(raw.invites, "invites").map(mapInvite),
		devices: toItems(raw.devices, "devices").map(mapMemberDevice),
		presence: toItems(raw.presence, "presence").map((peer) => {
			const entry = toRecord(peer)
			return {
				userId: requiredString(entry.user_id),
				filePath: requiredString(entry.file_path),
				canWrite: entry.can_write === true,
			}
		}),
	}
}

function mapSubscriptionStatusKind(value: unknown): SubscriptionStatusKind {
	const state = optionalString(value)?.toLowerCase()
	return SUBSCRIPTION_STATUS_KINDS.find((candidate) => candidate === state) ?? "unknown"
}

export function mapSubscriptionStatus(payload: unknown): SubscriptionStatus {
	const raw = toRecord(payload)
	return {
		status: mapSubscriptionStatusKind(raw.status),
		entitled: raw.entitled === true,
		currentPeriodStart: optionalString(raw.current_period_start),
		currentPeriodEnd: optionalString(raw.current_period_end),
		entitlementExpiresAt: optionalString(raw.entitlement_expires_at),
		billingCycle: optionalString(raw.billing_cycle),
		planProductId: optionalString(raw.plan_product_id),
	}
}
