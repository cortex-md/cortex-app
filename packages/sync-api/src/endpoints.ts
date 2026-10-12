import type {
	AcceptInviteResult,
	AccessRule,
	AuthStatus,
	CurrentUser,
	DeviceEntry,
	DeviceInfo,
	GroupUpdate,
	InviteOptions,
	InvitePreview,
	LoginResult,
	PathGrant,
	RegisterResult,
	RemoteVaultInfo,
	RemoteVaultSettings,
	SubscriptionStatus,
	VaultGroup,
	VaultInvite,
	VaultMember,
	VaultOverview,
} from "@cortex/platform"
import { type ApiClient, segment } from "./client"
import { expectOk } from "./errors"
import {
	mapAcceptedInvite,
	mapAccessRule,
	mapAccessRules,
	mapDevice,
	mapDevices,
	mapGroup,
	mapGroups,
	mapInvite,
	mapInvitePreview,
	mapMember,
	mapRemoteVault,
	mapRemoteVaults,
	mapSubscriptionStatus,
	mapVaultOverview,
	optionalString,
	toItems,
	toRecord,
} from "./mappers"
import type { AuthSession } from "./session"

export interface VaultEncryptionRecord {
	hasKey: boolean
	hasMemberKeys: boolean
	salt: string | null
	encryptedVek: string | null
}

export interface SessionTokens {
	accessToken: string
	refreshToken: string
}

export interface AccountKeyFields {
	kdfVersion: number
	publicKey: string | null
	encryptedPrivateKey: string | null
}

export interface LoginResponse extends SessionTokens, AccountKeyFields {
	userId: string
	email: string
	displayName: string | null
}

export interface KdfParameters {
	algorithm: string
	memoryKib: number
	iterations: number
	parallelism: number
}

export interface PreloginResponse {
	kdfVersion: number
	kdfSalt: string | null
	kdf: KdfParameters
}

export interface RegisterKeyMaterial {
	kdfSalt: string
	publicKey: string
	encryptedPrivateKey: string
	recoveryWrappedPrivateKey: string | null
}

export interface PendingVaultKeyMember {
	userId: string
	role: string
	publicKey: string | null
	displayName: string | null
	email: string | null
	avatarUrl: string | null
}

export const DEFAULT_KDF: KdfParameters = {
	algorithm: "argon2id",
	memoryKib: 65536,
	iterations: 3,
	parallelism: 1,
}

function numberOr(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

export function mapAccountKeyFields(raw: Record<string, unknown>): AccountKeyFields {
	return {
		kdfVersion: numberOr(raw.kdf_version, 0),
		publicKey: optionalString(raw.public_key),
		encryptedPrivateKey: optionalString(raw.encrypted_private_key),
	}
}

export async function requestPrelogin(api: ApiClient, email: string): Promise<PreloginResponse> {
	const body = toRecord(
		await api.json<unknown>("POST", "/auth/v1/prelogin", "Prelogin", { json: { email } }),
	)
	const kdf = toRecord(body.kdf)
	return {
		kdfVersion: numberOr(body.kdf_version, 0),
		kdfSalt: optionalString(body.kdf_salt),
		kdf: {
			algorithm: optionalString(kdf.algorithm) ?? DEFAULT_KDF.algorithm,
			memoryKib: numberOr(kdf.memory_kib, DEFAULT_KDF.memoryKib),
			iterations: numberOr(kdf.iterations, DEFAULT_KDF.iterations),
			parallelism: numberOr(kdf.parallelism, DEFAULT_KDF.parallelism),
		},
	}
}

export interface RefreshedTokens {
	accessToken: string | null
	refreshToken: string | null
}

export interface CheckoutOptions {
	returnUrl: string
	completionUrl: string
}

export async function requestLogin(
	api: ApiClient,
	email: string,
	password: string,
	device: DeviceInfo,
): Promise<LoginResponse> {
	const raw = toRecord(
		await api.json<unknown>("POST", "/auth/v1/login", "Login", {
			json: {
				email,
				password,
				device_id: device.deviceId,
				device_name: device.deviceName,
				device_type: device.deviceType,
			},
		}),
	)
	const body = { ...toRecord(raw.user), ...raw }
	return {
		accessToken: String(body.access_token ?? ""),
		refreshToken: String(body.refresh_token ?? ""),
		userId: String(body.user_id ?? ""),
		email: String(body.email ?? email),
		displayName: optionalString(body.display_name),
		...mapAccountKeyFields(body),
	}
}

export async function requestRegister(
	api: ApiClient,
	email: string,
	password: string,
	displayName: string,
	keys?: RegisterKeyMaterial,
): Promise<RegisterResult> {
	const body = toRecord(
		await api.json<unknown>("POST", "/auth/v1/register", "Register", {
			json: {
				email,
				password,
				display_name: displayName,
				...(keys
					? {
							kdf_salt: keys.kdfSalt,
							public_key: keys.publicKey,
							encrypted_private_key: keys.encryptedPrivateKey,
							recovery_wrapped_private_key: keys.recoveryWrappedPrivateKey ?? undefined,
						}
					: {}),
			},
		}),
	)
	return {
		userId: String(body.user_id ?? ""),
		email: String(body.email ?? email),
		displayName: optionalString(body.display_name) ?? displayName,
		recoveryKey: null,
	}
}

export async function requestRefresh(
	api: ApiClient,
	refreshToken: string,
): Promise<RefreshedTokens> {
	const body = toRecord(
		await api.json<unknown>("POST", "/auth/v1/token/refresh", "Token refresh", {
			json: { refresh_token: refreshToken },
		}),
	)
	return {
		accessToken: optionalString(body.access_token),
		refreshToken: optionalString(body.refresh_token),
	}
}

export async function requestLogout(api: ApiClient, allDevices: boolean): Promise<void> {
	await api.send("POST", "/auth/v1/logout", "Logout", { json: { all_devices: allDevices } })
}

export async function login(
	api: ApiClient,
	session: AuthSession,
	email: string,
	password: string,
	device: DeviceInfo,
): Promise<LoginResponse> {
	const response = await requestLogin(api, email, password, device)
	session.storeTokens(api.serverUrl, response.accessToken, response.refreshToken)
	session.storeUser(api.serverUrl, {
		userId: response.userId,
		email: response.email,
		displayName: response.displayName,
	})
	return response
}

export function toLoginResult(response: LoginResponse, recoveryKey: string | null): LoginResult {
	return {
		userId: response.userId,
		email: response.email,
		displayName: response.displayName,
		recoveryKey,
	}
}

export async function register(
	api: ApiClient,
	session: AuthSession,
	email: string,
	password: string,
	displayName: string,
	keys?: RegisterKeyMaterial,
): Promise<RegisterResult> {
	const user = await requestRegister(api, email, password, displayName, keys)
	session.storeUser(api.serverUrl, {
		userId: user.userId,
		email: user.email,
		displayName: user.displayName,
	})
	return user
}

export async function logout(
	api: ApiClient,
	session: AuthSession,
	allDevices: boolean,
): Promise<void> {
	try {
		await requestLogout(api, allDevices)
	} finally {
		session.clear(api.serverUrl)
	}
}

export function authStatus(session: AuthSession, serverUrl: string): AuthStatus {
	if (!session.hasTokens(serverUrl)) {
		return { authenticated: false, userId: null, email: null, displayName: null }
	}
	return { authenticated: true, ...session.getUser(serverUrl) }
}

export function currentUser(session: AuthSession, serverUrl: string): CurrentUser | null {
	const { userId, email, displayName } = session.getUser(serverUrl)
	return userId && email ? { userId, email, displayName } : null
}

export async function listRemoteVaults(api: ApiClient): Promise<RemoteVaultInfo[]> {
	return mapRemoteVaults(await api.json<unknown>("GET", "/vaults/v1/", "List vaults"))
}

export async function getRemoteVault(api: ApiClient, vaultId: string): Promise<RemoteVaultInfo> {
	return mapRemoteVault(
		await api.json<unknown>("GET", `/vaults/v1/${segment(vaultId)}/`, "Get vault"),
	)
}

export async function createRemoteVault(
	api: ApiClient,
	name: string,
	description: string | null,
	encryptedVaultKey: string,
	id: string = crypto.randomUUID(),
): Promise<RemoteVaultInfo> {
	return mapRemoteVault(
		await api.json<unknown>("POST", "/vaults/v1/", "Create vault", {
			json: { id, name, description, encrypted_vault_key: encryptedVaultKey },
		}),
	)
}

export async function updateRemoteVault(
	api: ApiClient,
	vaultId: string,
	name: string | null,
	description: string | null,
): Promise<RemoteVaultInfo> {
	return mapRemoteVault(
		await api.json<unknown>("PATCH", `/vaults/v1/${segment(vaultId)}/`, "Update vault", {
			json: { name, description },
		}),
	)
}

export async function updateRemoteVaultSettings(
	api: ApiClient,
	vaultId: string,
	settings: RemoteVaultSettings,
): Promise<RemoteVaultInfo> {
	const body: Record<string, unknown> = {
		name: settings.name,
		description: settings.description,
		icon: settings.icon,
		allowed_email_domains: settings.allowedEmailDomains,
		allow_guests: settings.allowGuests,
		allow_public_links: settings.allowPublicLinks,
	}
	if (settings.storageQuotaBytes !== undefined)
		body.storage_quota_bytes = settings.storageQuotaBytes
	return mapRemoteVault(
		await api.json<unknown>("PATCH", `/vaults/v1/${segment(vaultId)}/`, "Update vault settings", {
			json: body,
		}),
	)
}

export async function getVaultOverview(api: ApiClient, vaultId: string): Promise<VaultOverview> {
	return mapVaultOverview(
		await api.json<unknown>("GET", `/vaults/v1/${segment(vaultId)}/overview`, "Vault overview"),
		api.serverUrl,
	)
}

function grantPayload(grants: PathGrant[]): { path: string; can_write: boolean }[] {
	return grants.map((grant) => ({ path: grant.path, can_write: grant.canWrite }))
}

function vaultPath(vaultId: string, rest = ""): string {
	return `/vaults/v1/${segment(vaultId)}${rest}`
}

export async function listGroups(api: ApiClient, vaultId: string): Promise<VaultGroup[]> {
	return mapGroups(await api.json<unknown>("GET", vaultPath(vaultId, "/groups"), "List groups"))
}

export async function createGroup(
	api: ApiClient,
	vaultId: string,
	name: string,
	memberIds: string[],
): Promise<VaultGroup> {
	return mapGroup(
		await api.json<unknown>("POST", vaultPath(vaultId, "/groups"), "Create group", {
			json: { name, member_ids: memberIds },
		}),
	)
}

export async function updateGroup(
	api: ApiClient,
	vaultId: string,
	groupId: string,
	update: GroupUpdate,
): Promise<VaultGroup> {
	return mapGroup(
		await api.json<unknown>(
			"PATCH",
			vaultPath(vaultId, `/groups/${segment(groupId)}`),
			"Update group",
			{ json: { name: update.name, member_ids: update.memberIds } },
		),
	)
}

export async function deleteGroup(api: ApiClient, vaultId: string, groupId: string): Promise<void> {
	await api.send("DELETE", vaultPath(vaultId, `/groups/${segment(groupId)}`), "Delete group")
}

export async function listAccessRules(api: ApiClient, vaultId: string): Promise<AccessRule[]> {
	return mapAccessRules(
		await api.json<unknown>("GET", vaultPath(vaultId, "/access"), "List access rules"),
	)
}

export async function setAccessRule(
	api: ApiClient,
	vaultId: string,
	rule: AccessRule,
): Promise<AccessRule | null> {
	const response = await api.send("PUT", vaultPath(vaultId, "/access"), "Update access", {
		json: {
			path: rule.path,
			restricted: rule.restricted,
			entries: rule.entries.map((entry) => ({
				principal_type: entry.principalType,
				principal_id: entry.principalId,
				level: entry.level,
			})),
		},
	})
	const text = response.status === 204 ? "" : await response.text()
	if (!text.trim()) return null
	const raw = toRecord(JSON.parse(text))
	return typeof raw.path === "string" ? mapAccessRule(raw) : null
}

export async function getMyVaultKey(api: ApiClient, vaultId: string): Promise<string | null> {
	const response = await api.request("GET", vaultPath(vaultId, "/keys/me"))
	if (response.status === 404) {
		await response.body?.cancel().catch(() => undefined)
		return null
	}
	await expectOk(response, "Fetch vault key")
	return optionalString(toRecord(await response.json()).encrypted_key)
}

export async function putMyVaultKey(
	api: ApiClient,
	vaultId: string,
	encryptedKey: string,
): Promise<void> {
	await api.send("PUT", vaultPath(vaultId, "/keys/me"), "Store vault key", {
		json: { encrypted_key: encryptedKey },
	})
}

export async function listPendingVaultKeys(
	api: ApiClient,
	vaultId: string,
): Promise<PendingVaultKeyMember[]> {
	const raw = await api.json<unknown>(
		"GET",
		vaultPath(vaultId, "/keys/pending"),
		"List pending vault keys",
	)
	return toItems(raw, "pending").map((item) => {
		const entry = toRecord(item)
		return {
			userId: String(entry.user_id ?? ""),
			role: optionalString(entry.role) ?? "unknown",
			publicKey: optionalString(entry.public_key),
			displayName: optionalString(entry.display_name),
			email: optionalString(entry.email),
			avatarUrl: optionalString(entry.avatar_url),
		}
	})
}

export async function grantVaultKey(
	api: ApiClient,
	vaultId: string,
	userId: string,
	encryptedKey: string,
): Promise<void> {
	await api.send("PUT", vaultPath(vaultId, `/keys/${segment(userId)}`), "Grant vault key", {
		json: { encrypted_key: encryptedKey },
	})
}

export async function deleteRemoteVault(api: ApiClient, vaultId: string): Promise<void> {
	await api.send("DELETE", `/vaults/v1/${segment(vaultId)}/`, "Delete vault")
}

export async function listMembers(api: ApiClient, vaultId: string): Promise<VaultMember[]> {
	const raw = await api.json<unknown>(
		"GET",
		`/vaults/v1/${segment(vaultId)}/members/`,
		"List members",
	)
	return toItems(raw, "members").map((member) => mapMember(member, api.serverUrl))
}

export async function updateMemberRole(
	api: ApiClient,
	vaultId: string,
	userId: string,
	role: string,
): Promise<void> {
	await api.send(
		"PATCH",
		`/vaults/v1/${segment(vaultId)}/members/${segment(userId)}`,
		"Update member role",
		{ json: { role } },
	)
}

export async function removeMember(api: ApiClient, vaultId: string, userId: string): Promise<void> {
	await api.send(
		"DELETE",
		`/vaults/v1/${segment(vaultId)}/members/${segment(userId)}`,
		"Remove member",
	)
}

export async function createInvite(
	api: ApiClient,
	vaultId: string,
	inviteeEmail: string,
	role: string,
	encryptedVaultKey: string,
	options: InviteOptions & { id?: string } = {},
): Promise<VaultInvite> {
	return mapInvite(
		await api.json<unknown>("POST", `/vaults/v1/${segment(vaultId)}/invites/`, "Invite", {
			json: {
				id: options.id ?? crypto.randomUUID(),
				invitee_email: inviteeEmail,
				role,
				encrypted_vault_key: encryptedVaultKey,
				grants: options.grants ? grantPayload(options.grants) : undefined,
			},
		}),
	)
}

export async function listInvites(api: ApiClient, vaultId: string): Promise<VaultInvite[]> {
	const raw = await api.json<unknown>(
		"GET",
		`/vaults/v1/${segment(vaultId)}/invites/`,
		"List invites",
	)
	return toItems(raw, "invites").map(mapInvite)
}

export async function deleteInvite(
	api: ApiClient,
	vaultId: string,
	inviteId: string,
): Promise<void> {
	await api.send(
		"DELETE",
		`/vaults/v1/${segment(vaultId)}/invites/${segment(inviteId)}`,
		"Delete invite",
	)
}

export async function myInvites(api: ApiClient): Promise<VaultInvite[]> {
	const raw = await api.json<unknown>("GET", "/vaults/v1/invites", "List my invites")
	return toItems(raw, "invites").map(mapInvite)
}

export async function acceptInvite(api: ApiClient, inviteId: string): Promise<AcceptInviteResult> {
	return mapAcceptedInvite(
		await api.json<unknown>("POST", "/vaults/v1/invites/accept", "Accept invite", {
			json: { invite_id: inviteId },
		}),
	)
}

export interface AcceptedInviteLink {
	vault: AcceptInviteResult
	encryptedVaultKey: string | null
}

export async function acceptInviteToken(
	api: ApiClient,
	token: string,
): Promise<AcceptedInviteLink> {
	const raw = await api.json<unknown>("POST", "/vaults/v1/invites/accept", "Accept invite", {
		json: { token },
	})
	return {
		vault: mapAcceptedInvite(raw),
		encryptedVaultKey: optionalString(toRecord(raw).encrypted_vault_key),
	}
}

export async function previewInvite(api: ApiClient, token: string): Promise<InvitePreview> {
	return mapInvitePreview(
		await api.json<unknown>("GET", `/invites/v1/${segment(token)}`, "Invite preview"),
	)
}

export async function getVaultEncryption(
	api: ApiClient,
	vaultId: string,
): Promise<VaultEncryptionRecord> {
	const body = toRecord(
		await api.json<unknown>(
			"GET",
			`/sync/v1/vaults/${segment(vaultId)}/encryption`,
			"Fetch vault encryption",
		),
	)
	return {
		hasKey: body.has_key === true,
		hasMemberKeys: body.has_member_keys === true,
		salt: optionalString(body.salt),
		encryptedVek: optionalString(body.encrypted_vek),
	}
}

export async function storeVaultEncryption(
	api: ApiClient,
	vaultId: string,
	salt: string,
	encryptedVek: string,
): Promise<void> {
	await api.send("POST", `/sync/v1/vaults/${segment(vaultId)}/encryption`, "Create vault key", {
		json: { salt, encrypted_vek: encryptedVek },
	})
}

export async function wrappedVaultKey(api: ApiClient, vaultId: string): Promise<string> {
	const record = await getVaultEncryption(api, vaultId)
	if (!record.encryptedVek) {
		throw new Error("Vault encryption key not available. Unlock the vault first.")
	}
	return record.encryptedVek
}

export async function listDevices(api: ApiClient): Promise<DeviceEntry[]> {
	return mapDevices(await api.json<unknown>("GET", "/devices/v1/", "List devices"))
}

export async function getDevice(api: ApiClient, deviceId: string): Promise<DeviceEntry> {
	return mapDevice(await api.json<unknown>("GET", `/devices/v1/${segment(deviceId)}`, "Get device"))
}

export async function renameDevice(
	api: ApiClient,
	deviceId: string,
	deviceName: string,
): Promise<DeviceEntry> {
	return mapDevice(
		await api.json<unknown>("PATCH", `/devices/v1/${segment(deviceId)}`, "Rename device", {
			json: { device_name: deviceName },
		}),
	)
}

export async function revokeDevice(api: ApiClient, deviceId: string): Promise<void> {
	await api.send("DELETE", `/devices/v1/${segment(deviceId)}`, "Revoke device")
}

export async function getSubscriptionStatus(api: ApiClient): Promise<SubscriptionStatus> {
	const response = await api.request("GET", "/subscription/v1/status")
	if (response.status === 404) {
		return {
			status: "disabled",
			entitled: true,
			currentPeriodStart: null,
			currentPeriodEnd: null,
			entitlementExpiresAt: null,
			billingCycle: null,
			planProductId: null,
		}
	}
	await expectOk(response, "Subscription status")
	return mapSubscriptionStatus(await response.json())
}

function toHttpUrl(value: unknown): string | null {
	if (typeof value !== "string") return null
	try {
		const url = new URL(value)
		return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null
	} catch {
		return null
	}
}

export async function createCheckout(api: ApiClient, options: CheckoutOptions): Promise<string> {
	const body = toRecord(
		await api.json<unknown>("POST", "/subscription/v1/checkout", "Create checkout", {
			json: { return_url: options.returnUrl, completion_url: options.completionUrl },
		}),
	)
	const checkoutUrl = toHttpUrl(body.checkout_url)
	if (!checkoutUrl) throw new Error("Cortex Sync did not return a checkout URL.")
	return checkoutUrl
}
