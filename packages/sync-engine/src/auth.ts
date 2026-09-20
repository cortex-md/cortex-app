import {
	clearTokensAndUserInfoForServer,
	getUserForServer,
	hasTokensForServer,
	parseResponse,
	type SyncHttpClient,
	storeTokensForServer,
	storeUserForServer,
} from "./http"

export interface LoginResponse {
	accessToken: string
	refreshToken: string
	userId: string
	email: string
	displayName?: string | null
}

export interface RegisterResponse {
	userId: string
	email: string
	displayName: string
}

export interface AuthStatus {
	authenticated: boolean
	userId: string | null
	email: string | null
	displayName: string | null
}

export interface CurrentUser {
	userId: string
	email: string
	displayName: string | null
}

export interface DeviceInfoLike {
	deviceId: string
	deviceName: string
	deviceType: string
}

export async function login(
	client: SyncHttpClient,
	email: string,
	password: string,
	device: DeviceInfoLike,
): Promise<LoginResponse> {
	const response = await client.postJson("/auth/v1/login", {
		email,
		password,
		device_id: device.deviceId,
		device_name: device.deviceName,
		device_type: device.deviceType,
	})
	const body = await parseResponse<{
		access_token: string
		refresh_token: string
		user_id: string
		email: string
		display_name?: string | null
	}>(response)

	const serverUrl = client.getServerUrl()
	storeTokensForServer(client.keychainHandle, serverUrl, body.access_token, body.refresh_token)
	storeUserForServer(client.keychainHandle, serverUrl, body.user_id, body.email, body.display_name)

	return {
		accessToken: body.access_token,
		refreshToken: body.refresh_token,
		userId: body.user_id,
		email: body.email,
		displayName: body.display_name ?? null,
	}
}

export async function register(
	client: SyncHttpClient,
	email: string,
	password: string,
	displayName: string,
): Promise<RegisterResponse> {
	const response = await client.postJson("/auth/v1/register", {
		email,
		password,
		display_name: displayName,
	})
	const body = await parseResponse<{
		user_id: string
		email: string
		display_name: string
	}>(response)

	storeUserForServer(
		client.keychainHandle,
		client.getServerUrl(),
		body.user_id,
		body.email,
		body.display_name,
	)

	return {
		userId: body.user_id,
		email: body.email,
		displayName: body.display_name,
	}
}

export async function logout(
	client: SyncHttpClient,
	serverUrl: string,
	allDevices: boolean,
): Promise<void> {
	client.setServerUrl(serverUrl)
	let remoteError: Error | null = null
	try {
		const response = await client.postJson("/auth/v1/logout", { all_devices: allDevices })
		if (!response.ok) {
			const body = await response.text()
			remoteError = new Error(`Logout failed: HTTP ${response.status}: ${body}`)
		}
	} catch (error) {
		remoteError = error instanceof Error ? error : new Error(String(error))
	}
	clearTokensAndUserInfoForServer(client.keychainHandle, serverUrl)
	if (remoteError) throw remoteError
}

export function getAuthStatus(client: SyncHttpClient, serverUrl: string): AuthStatus {
	const authenticated = hasTokensForServer(client.keychainHandle, serverUrl)
	if (!authenticated) {
		return {
			authenticated: false,
			userId: null,
			email: null,
			displayName: null,
		}
	}
	const user = getUserForServer(client.keychainHandle, serverUrl)
	return {
		authenticated: true,
		userId: user.userId,
		email: user.email,
		displayName: user.displayName,
	}
}

export function getCurrentUser(client: SyncHttpClient, serverUrl: string): CurrentUser | null {
	const user = getUserForServer(client.keychainHandle, serverUrl)
	if (!user.userId || !user.email) return null
	return {
		userId: user.userId,
		email: user.email,
		displayName: user.displayName,
	}
}
