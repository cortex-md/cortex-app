import { getDeviceInfo } from "./device"
import * as http from "./httpClient"

export interface LoginResult {
	userId: string
	email: string
	displayName: string | null
}

export interface RegisterResult {
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

interface LoginResponse {
	access_token: string
	refresh_token: string
	user_id: string
	email: string
	display_name?: string | null
}

interface RegisterResponse {
	user_id: string
	email: string
	display_name: string
}

export async function login(
	serverUrl: string,
	email: string,
	password: string,
): Promise<LoginResult> {
	http.setServerUrl(serverUrl)
	const device = getDeviceInfo()
	const response = await http.postJson("/auth/v1/login", {
		email,
		password,
		device_id: device.deviceId,
		device_name: device.deviceName,
		device_type: device.deviceType,
	})
	const loginResp = await http.parseResponse<LoginResponse>(response)
	const normalized = http.getServerUrl()
	http.storeTokensForServer(normalized, loginResp.access_token, loginResp.refresh_token)
	http.storeUserForServer(
		normalized,
		loginResp.user_id,
		loginResp.email,
		loginResp.display_name ?? null,
	)
	return {
		userId: loginResp.user_id,
		email: loginResp.email,
		displayName: loginResp.display_name ?? null,
	}
}

export async function register(
	serverUrl: string,
	email: string,
	password: string,
	displayName: string,
): Promise<RegisterResult> {
	http.setServerUrl(serverUrl)
	const response = await http.postJson("/auth/v1/register", {
		email,
		password,
		display_name: displayName,
	})
	const registerResp = await http.parseResponse<RegisterResponse>(response)
	http.storeUserForServer(
		http.getServerUrl(),
		registerResp.user_id,
		registerResp.email,
		registerResp.display_name,
	)
	return {
		userId: registerResp.user_id,
		email: registerResp.email,
		displayName: registerResp.display_name,
	}
}

export async function logout(serverUrl: string, allDevices: boolean): Promise<void> {
	http.setServerUrl(serverUrl)
	let remoteError: Error | null = null
	try {
		const response = await http.postJson("/auth/v1/logout", { all_devices: allDevices })
		if (!response.ok) {
			const body = await response.text().catch(() => "")
			remoteError = new Error(`Logout failed: HTTP ${response.status}: ${body}`)
		}
	} catch (error) {
		remoteError = error instanceof Error ? error : new Error(String(error))
	}
	http.clearTokensAndUserInfoForServer(serverUrl)
	if (remoteError) throw remoteError
}

export function getAuthStatus(serverUrl?: string | null): AuthStatus {
	const url = serverUrl || http.getServerUrl()
	if (url) http.setServerUrl(url)
	const authenticated = http.hasTokensForServer(url)
	if (!authenticated) {
		return {
			authenticated: false,
			userId: null,
			email: null,
			displayName: null,
		}
	}
	const [userId, email, displayName] = http.getUserForServer(url)
	return {
		authenticated: true,
		userId,
		email,
		displayName,
	}
}

export function getCurrentUser(serverUrl?: string | null): CurrentUser | null {
	const url = serverUrl || http.getServerUrl()
	if (url) http.setServerUrl(url)
	const [userId, email, displayName] = http.getUserForServer(url)
	if (!userId || !email) return null
	return { userId, email, displayName }
}
