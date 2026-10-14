import type {
	Account,
	Auth,
	DeviceInfo,
	Devices,
	Members,
	RemoteVault,
	Subscription,
	Sync,
} from "@cortex/platform"
import * as account from "./account"
import {
	type AccountIdentity,
	type AccountKeyCrypto,
	AccountKeyStore,
	assertPasswordStrength,
	createAccountIdentity,
	hasDerivedPassword,
} from "./accountKeys"
import { ApiClient, type FetchLike, normalizeServerUrl } from "./client"
import * as endpoints from "./endpoints"
import { SyncError } from "./errors"
import { type SecretStore, vekSecretKey } from "./secrets"
import { AuthSession } from "./session"

const SERVER_URL_KEY = "server_url"

export interface InviteKeyLink {
	encryptedVaultKey: string
	linkKey: string
}

export interface ServerApiOptions {
	secrets: SecretStore
	getDeviceInfo: () => DeviceInfo | Promise<DeviceInfo>
	resetDeviceId?: () => DeviceInfo | Promise<DeviceInfo>
	onSessionExpired?: (serverUrl: string) => void
	fetch?: FetchLike
	createInviteKeyLink?: (vaultId: string) => Promise<InviteKeyLink | null>
	storeInviteKey?: (vaultId: string, encryptedVaultKey: string, linkKey: string) => Promise<void>
	keyCrypto?: AccountKeyCrypto
}

export interface ServerApiServices {
	auth: Auth
	account: Account
	devices: Devices
	members: Members
	subscription: Subscription
	remoteVault: RemoteVault
	checkVaultEncryption: Sync["checkVaultEncryption"]
	session: AuthSession
	keys: AccountKeyStore
	currentIdentity(serverUrl?: string | null): Promise<AccountIdentity | null>
	currentUserId(serverUrl?: string | null): Promise<string | null>
	selectServerUrl(serverUrl?: string | null): Promise<string>
	client(serverUrl?: string | null): Promise<ApiClient>
}

export function createServerApiServices(options: ServerApiOptions): ServerApiServices {
	const { secrets } = options
	const session = new AuthSession(secrets, {
		onSessionExpired: options.onSessionExpired,
		fetch: options.fetch,
	})
	const keys = new AccountKeyStore(secrets, options.keyCrypto ?? null)
	let activeServerUrl = ""

	const selectServerUrl = async (serverUrl?: string | null): Promise<string> => {
		if (serverUrl) activeServerUrl = normalizeServerUrl(serverUrl)
		if (!activeServerUrl) {
			await secrets.preload?.([SERVER_URL_KEY])
			activeServerUrl = normalizeServerUrl(secrets.get(SERVER_URL_KEY) ?? "")
		}
		return activeServerUrl
	}

	const client = async (serverUrl?: string | null): Promise<ApiClient> => {
		const url = await selectServerUrl(serverUrl)
		if (!url) throw new Error("No sync server configured")
		const [device] = await Promise.all([options.getDeviceInfo(), session.load(url)])
		return new ApiClient(url, { deviceId: device.deviceId, tokens: session, fetch: options.fetch })
	}

	const loginWithFreshDevice = async (serverUrl: string, email: string, password: string) => {
		try {
			return await endpoints.login(
				await client(serverUrl),
				session,
				email,
				password,
				await options.getDeviceInfo(),
			)
		} catch (error) {
			if (
				!(error instanceof SyncError && error.code === "device_conflict") ||
				!options.resetDeviceId
			) {
				throw error
			}
			const device = await options.resetDeviceId()
			return await endpoints.login(await client(serverUrl), session, email, password, device)
		}
	}

	const loadedServerUrl = async (serverUrl?: string | null): Promise<string> => {
		const url = await selectServerUrl(serverUrl)
		await session.load(url)
		return url
	}

	const currentUserId = async (serverUrl?: string | null): Promise<string | null> =>
		session.getUser(await loadedServerUrl(serverUrl)).userId

	const prelogin = async (api: ApiClient, email: string) => {
		try {
			return await endpoints.requestPrelogin(api, email)
		} catch (error) {
			if (error instanceof SyncError && error.status === 404) return null
			throw error
		}
	}

	const login = async (serverUrl: string, email: string, password: string) => {
		const api = await client(serverUrl)
		const kdf = await prelogin(api, email)
		if (kdf && hasDerivedPassword(kdf.kdfVersion)) {
			const crypto = keys.requireCrypto()
			if (!kdf.kdfSalt) throw new Error("Cortex Sync did not return the account key parameters.")
			const derived = await crypto.deriveKeys(password, kdf.kdfSalt)
			const response = await loginWithFreshDevice(serverUrl, email, derived.authKey)
			const encryptedPrivateKey =
				response.encryptedPrivateKey ??
				(await account.getAccountKeys(await client(serverUrl))).encryptedPrivateKey
			if (encryptedPrivateKey) {
				keys.storePrivateKey(
					response.userId,
					keys.unlockPrivateKey(encryptedPrivateKey, derived.wrapKey),
				)
			}
			return endpoints.toLoginResult(response, null)
		}
		const response = await loginWithFreshDevice(serverUrl, email, password)
		let recoveryKey: string | null = null
		if (kdf && keys.crypto) {
			try {
				recoveryKey = await keys.upgradeLegacyAccount(
					await client(serverUrl),
					response.userId,
					password,
				)
			} catch (error) {
				console.warn("[sync-api] account key upgrade failed:", error)
			}
		}
		return endpoints.toLoginResult(response, recoveryKey)
	}

	const register = async (
		serverUrl: string,
		email: string,
		password: string,
		displayName: string,
	) => {
		assertPasswordStrength(password)
		const api = await client(serverUrl)
		if (!keys.crypto || (await prelogin(api, email)) === null) {
			return await endpoints.register(api, session, email, password, displayName)
		}
		const created = await createAccountIdentity(keys.crypto, password)
		const user = await endpoints.register(
			api,
			session,
			email,
			created.authKey,
			displayName,
			created,
		)
		keys.storePrivateKey(user.userId, created.privateKey)
		return { ...user, recoveryKey: created.recoveryKey }
	}

	const logout = async (serverUrl: string, allDevices: boolean) => {
		const userId = await currentUserId(serverUrl)
		try {
			await endpoints.logout(await client(serverUrl), session, allDevices)
		} finally {
			keys.clear(userId)
		}
	}

	return {
		session,
		keys,
		currentUserId,
		currentIdentity: async (serverUrl) => await keys.identity(await currentUserId(serverUrl)),
		selectServerUrl,
		client,
		auth: {
			login,
			register,
			logout,
			resetPassword: async (serverUrl, token, newPassword, recoveryKey) =>
				await keys.resetPassword(await client(serverUrl), token, newPassword, recoveryKey),
			getStatus: async (serverUrl) =>
				endpoints.authStatus(session, await loadedServerUrl(serverUrl)),
			getCurrentUser: async (serverUrl) =>
				endpoints.currentUser(session, await loadedServerUrl(serverUrl)),
		},
		account: {
			getCapabilities: async (serverUrl) =>
				await account.getServerCapabilities(await client(serverUrl)),
			getProfile: async () => await account.getAccountProfile(await client()),
			getOverview: async () => await account.getAccountOverview(await client()),
			updateProfile: async (update) => await account.updateAccountProfile(await client(), update),
			changePassword: async (currentPassword, newPassword) =>
				await keys.changePassword(
					await client(),
					await currentUserId(),
					currentPassword,
					newPassword,
				),
			requestEmailChange: async (password, newEmail) => {
				const api = await client()
				return await account.requestAccountEmailChange(
					api,
					await keys.derivedPassword(api, password),
					newEmail,
				)
			},
			resendEmailVerification: async () => await account.resendEmailVerification(await client()),
			setAvatar: async (image, contentType) =>
				await account.setAccountAvatar(await client(), image, contentType),
			deleteAvatar: async () => await account.deleteAccountAvatar(await client()),
			getKeyStatus: async () => await keys.keyStatus(await client(), await currentUserId()),
			setupKeys: async (password) => {
				const userId = await currentUserId()
				if (!userId) throw new Error("Sign in to Cortex Sync first.")
				return await keys.setupKeys(await client(), userId, password)
			},
			regenerateRecoveryKey: async () =>
				await keys.regenerateRecoveryKey(await client(), await currentUserId()),
		},
		devices: {
			list: async () => await endpoints.listDevices(await client()),
			get: async (deviceId) => await endpoints.getDevice(await client(), deviceId),
			rename: async (deviceId, deviceName) =>
				await endpoints.renameDevice(await client(), deviceId, deviceName),
			revoke: async (deviceId) => await endpoints.revokeDevice(await client(), deviceId),
		},
		members: {
			listMembers: async (vaultId) => await endpoints.listMembers(await client(), vaultId),
			getVaultOverview: async (vaultId) =>
				await endpoints.getVaultOverview(await client(), vaultId),
			listGroups: async (vaultId) => await endpoints.listGroups(await client(), vaultId),
			createGroup: async (vaultId, name, memberIds) =>
				await endpoints.createGroup(await client(), vaultId, name, memberIds),
			updateGroup: async (vaultId, groupId, update) =>
				await endpoints.updateGroup(await client(), vaultId, groupId, update),
			deleteGroup: async (vaultId, groupId) =>
				await endpoints.deleteGroup(await client(), vaultId, groupId),
			listAccessRules: async (vaultId) => await endpoints.listAccessRules(await client(), vaultId),
			setAccessRule: async (vaultId, rule) =>
				await endpoints.setAccessRule(await client(), vaultId, rule),
			updateMemberRole: async (vaultId, userId, role) =>
				await endpoints.updateMemberRole(await client(), vaultId, userId, role),
			removeMember: async (vaultId, userId) =>
				await endpoints.removeMember(await client(), vaultId, userId),
			createInvite: async (vaultId, inviteeEmail, role, encryptedVaultKey, inviteOptions) => {
				const api = await client()
				if (encryptedVaultKey) {
					return await endpoints.createInvite(
						api,
						vaultId,
						inviteeEmail,
						role,
						encryptedVaultKey,
						inviteOptions,
					)
				}
				const link = await options.createInviteKeyLink?.(vaultId)
				const key = link?.encryptedVaultKey ?? ""
				const invite = await endpoints.createInvite(
					api,
					vaultId,
					inviteeEmail,
					role,
					key,
					inviteOptions,
				)
				if (!link || !invite.inviteUrl) return invite
				return { ...invite, inviteUrl: `${invite.inviteUrl}#k=${link.linkKey}` }
			},
			listInvites: async (vaultId) => await endpoints.listInvites(await client(), vaultId),
			deleteInvite: async (vaultId, inviteId) =>
				await endpoints.deleteInvite(await client(), vaultId, inviteId),
			myInvites: async () => await endpoints.myInvites(await client()),
			acceptInvite: async (inviteId) => await endpoints.acceptInvite(await client(), inviteId),
			previewInvite: async (token) => await endpoints.previewInvite(await client(), token),
			acceptInviteLink: async (token, linkKey) => {
				const accepted = await endpoints.acceptInviteToken(await client(), token)
				if (linkKey && accepted.encryptedVaultKey && options.storeInviteKey) {
					await options.storeInviteKey(accepted.vault.id, accepted.encryptedVaultKey, linkKey)
				}
				return accepted.vault
			},
		},
		subscription: {
			getStatus: async (serverUrl) =>
				await endpoints.getSubscriptionStatus(await client(serverUrl)),
		},
		remoteVault: {
			create: async (name, description) =>
				await endpoints.createRemoteVault(await client(), name, description, ""),
			list: async () => await endpoints.listRemoteVaults(await client()),
			get: async (vaultId) => await endpoints.getRemoteVault(await client(), vaultId),
			update: async (vaultId, name, description) =>
				await endpoints.updateRemoteVault(await client(), vaultId, name, description),
			updateSettings: async (vaultId, settings) =>
				await endpoints.updateRemoteVaultSettings(await client(), vaultId, settings),
			delete: async (vaultId) => await endpoints.deleteRemoteVault(await client(), vaultId),
		},
		checkVaultEncryption: async (vaultId) => {
			const secretKey = vekSecretKey(vaultId)
			const [record] = await Promise.all([
				endpoints.getVaultEncryption(await client(), vaultId),
				secrets.preload?.([secretKey]),
			])
			const hasPasswordKey = record.hasKey && record.encryptedVek !== null
			return {
				hasKey: hasPasswordKey || record.hasMemberKeys,
				hasPasswordKey,
				hasLocalKey: secrets.get(secretKey) !== null,
			}
		},
	}
}
