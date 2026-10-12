import type {
	AccountOverview,
	AccountProfile,
	EmailChangeResult,
	ProfileUpdate,
	ServerCapabilities,
} from "@cortex/platform"
import type { ApiClient } from "./client"
import {
	mapAccountOverview,
	mapAccountProfile,
	mapCapabilities,
	optionalString,
	toRecord,
} from "./mappers"

export interface AccountKeys {
	kdfVersion: number
	kdfSalt: string | null
	publicKey: string | null
	encryptedPrivateKey: string | null
	hasRecovery: boolean
}

export interface AccountKeyUpdate {
	currentPassword: string
	password: string
	kdfSalt: string
	publicKey: string
	encryptedPrivateKey: string
	recoveryWrappedPrivateKey: string | null
}

export interface PasswordKeyFields {
	kdfSalt: string
	encryptedPrivateKey: string
}

export interface PasswordResetKeys {
	publicKey: string | null
	recoveryWrappedPrivateKey: string | null
}

export interface PasswordResetInput {
	token: string
	password: string
	kdfSalt?: string
	publicKey?: string
	encryptedPrivateKey?: string
	recoveryWrappedPrivateKey?: string | null
}

export async function getAccountKeys(api: ApiClient): Promise<AccountKeys> {
	const raw = toRecord(await api.json<unknown>("GET", "/account/v1/me/keys", "Account keys"))
	return {
		kdfVersion: typeof raw.kdf_version === "number" ? raw.kdf_version : 0,
		kdfSalt: optionalString(raw.kdf_salt),
		publicKey: optionalString(raw.public_key),
		encryptedPrivateKey: optionalString(raw.encrypted_private_key),
		hasRecovery: raw.has_recovery === true,
	}
}

export async function updateAccountKeys(api: ApiClient, update: AccountKeyUpdate): Promise<void> {
	await api.send("PUT", "/account/v1/me/keys", "Update account keys", {
		json: {
			current_password: update.currentPassword,
			password: update.password,
			kdf_salt: update.kdfSalt,
			public_key: update.publicKey,
			encrypted_private_key: update.encryptedPrivateKey,
			recovery_wrapped_private_key: update.recoveryWrappedPrivateKey ?? undefined,
		},
	})
}

export async function updateAccountRecovery(
	api: ApiClient,
	recoveryWrappedPrivateKey: string,
): Promise<void> {
	await api.send("PUT", "/account/v1/me/recovery", "Update recovery key", {
		json: { recovery_wrapped_private_key: recoveryWrappedPrivateKey },
	})
}

export async function preparePasswordReset(
	api: ApiClient,
	token: string,
): Promise<PasswordResetKeys> {
	const raw = toRecord(
		await api.json<unknown>(
			"POST",
			"/account/v1/password/reset/prepare",
			"Prepare password reset",
			{
				json: { token },
			},
		),
	)
	return {
		publicKey: optionalString(raw.public_key),
		recoveryWrappedPrivateKey: optionalString(raw.recovery_wrapped_private_key),
	}
}

export async function resetAccountPassword(
	api: ApiClient,
	input: PasswordResetInput,
): Promise<void> {
	await api.send("POST", "/account/v1/password/reset", "Reset password", {
		json: {
			token: input.token,
			password: input.password,
			kdf_salt: input.kdfSalt,
			public_key: input.publicKey,
			encrypted_private_key: input.encryptedPrivateKey,
			recovery_wrapped_private_key: input.recoveryWrappedPrivateKey ?? undefined,
		},
	})
}

export async function getServerCapabilities(api: ApiClient): Promise<ServerCapabilities> {
	return mapCapabilities(await api.json<unknown>("GET", "/meta/v1/capabilities", "Capabilities"))
}

export async function getAccountProfile(api: ApiClient): Promise<AccountProfile> {
	return mapAccountProfile(
		await api.json<unknown>("GET", "/account/v1/me/", "Account profile"),
		api.serverUrl,
	)
}

export async function getAccountOverview(api: ApiClient): Promise<AccountOverview> {
	return mapAccountOverview(
		await api.json<unknown>("GET", "/account/v1/overview", "Account overview"),
		api.serverUrl,
	)
}

export async function updateAccountProfile(
	api: ApiClient,
	update: ProfileUpdate,
): Promise<AccountProfile> {
	return mapAccountProfile(
		await api.json<unknown>("PATCH", "/account/v1/me/", "Update profile", {
			json: { display_name: update.displayName, locale: update.locale },
		}),
		api.serverUrl,
	)
}

export async function changeAccountPassword(
	api: ApiClient,
	currentPassword: string,
	newPassword: string,
	keys?: PasswordKeyFields,
): Promise<void> {
	await api.send("PUT", "/account/v1/me/password", "Change password", {
		json: {
			current_password: currentPassword,
			new_password: newPassword,
			kdf_salt: keys?.kdfSalt,
			encrypted_private_key: keys?.encryptedPrivateKey,
		},
	})
}

export async function requestAccountEmailChange(
	api: ApiClient,
	password: string,
	newEmail: string,
): Promise<EmailChangeResult> {
	const response = await api.send("POST", "/account/v1/me/email", "Change email", {
		json: { password, new_email: newEmail },
	})
	return { applied: response.status === 200 }
}

export async function resendEmailVerification(api: ApiClient): Promise<void> {
	await api.send("POST", "/account/v1/me/email/verification", "Send verification email", {
		json: {},
	})
}

export async function setAccountAvatar(
	api: ApiClient,
	image: Uint8Array,
	contentType: string,
): Promise<AccountProfile> {
	return mapAccountProfile(
		await api.json<unknown>("PUT", "/account/v1/me/avatar", "Upload avatar", {
			body: image,
			headers: { "Content-Type": contentType },
		}),
		api.serverUrl,
	)
}

export async function deleteAccountAvatar(api: ApiClient): Promise<void> {
	await api.send("DELETE", "/account/v1/me/avatar", "Remove avatar")
}
