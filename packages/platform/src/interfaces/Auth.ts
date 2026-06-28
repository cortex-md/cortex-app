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

export interface Auth {
	login(serverUrl: string, email: string, password: string): Promise<LoginResult>
	register(
		serverUrl: string,
		email: string,
		password: string,
		displayName: string,
	): Promise<RegisterResult>
	logout(serverUrl: string, allDevices: boolean): Promise<void>
	getStatus(serverUrl?: string): Promise<AuthStatus>
	getCurrentUser(serverUrl?: string): Promise<CurrentUser | null>
}
