import type { AuthStatus } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"

type AuthStatusRefresher = (serverUrl: string) => Promise<AuthStatus>

let authStatusRefresher: AuthStatusRefresher | null = null

function createUnauthenticatedStatus(): AuthStatus {
	return {
		authenticated: false,
		userId: null,
		email: null,
		displayName: null,
	}
}

export function setAuthStatusRefresher(refresher: AuthStatusRefresher): void {
	authStatusRefresher = refresher
}

export async function refreshAuthStatus(serverUrl: string): Promise<AuthStatus> {
	try {
		return authStatusRefresher
			? await authStatusRefresher(serverUrl)
			: await getPlatform().auth.getStatus(serverUrl)
	} catch {
		return createUnauthenticatedStatus()
	}
}
