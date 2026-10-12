import { ApiClient, requestRefresh, SyncError, type TokenProvider } from "@cortex/sync-api"
import type { AuthSession } from "../auth"
import { getSyncBaseUrl, type SyncRuntimeEnv } from "./config"

export interface SyncDependencies {
	env?: SyncRuntimeEnv
	fetcher?: typeof fetch
}

export interface SessionDependencies extends SyncDependencies {
	onSessionCleared?: () => void
	onSessionRefreshed?: (session: AuthSession) => void
	session?: AuthSession | null
}

const authFailureCodes = new Set(["token_expired", "token_revoked", "token_reuse"])

export function createSyncClient(
	dependencies: SyncDependencies,
	deviceId?: string,
	tokens?: TokenProvider,
) {
	return new ApiClient(getSyncBaseUrl(dependencies.env), {
		deviceId,
		tokens,
		fetch: dependencies.fetcher,
	})
}

export function isAuthFailure(error: unknown) {
	return (
		error instanceof SyncError &&
		(error.status === 401 || (error.code !== null && authFailureCodes.has(error.code)))
	)
}

export async function refreshAuthSession(
	session: AuthSession,
	dependencies: SyncDependencies = {},
): Promise<AuthSession> {
	const tokens = await requestRefresh(createSyncClient(dependencies), session.refreshToken)
	if (!tokens.accessToken) throw new Error("Cortex Sync did not return an access token.")

	return {
		...session,
		accessToken: tokens.accessToken,
		refreshToken: tokens.refreshToken ?? session.refreshToken,
	}
}

export async function resolveActiveSession(dependencies: SessionDependencies) {
	const session = dependencies.session ?? null
	if (!session || session.accessToken) return session

	try {
		const refreshedSession = await refreshAuthSession(session, dependencies)
		dependencies.onSessionRefreshed?.(refreshedSession)
		return refreshedSession
	} catch {
		dependencies.onSessionCleared?.()
		return null
	}
}

export function createSessionClient(session: AuthSession, dependencies: SessionDependencies) {
	let currentSession = session
	let pendingRefresh: Promise<string | null> | null = null

	const tokens: TokenProvider = {
		getAccessToken: async () => currentSession.accessToken || null,
		refreshAccessToken: () => {
			pendingRefresh ??= refreshAuthSession(currentSession, dependencies)
				.then((refreshedSession) => {
					currentSession = refreshedSession
					dependencies.onSessionRefreshed?.(refreshedSession)
					return refreshedSession.accessToken
				})
				.catch(() => null)
				.finally(() => {
					pendingRefresh = null
				})
			return pendingRefresh
		},
	}

	return {
		api: createSyncClient(dependencies, session.deviceId, tokens),
		getSession: () => currentSession,
	}
}
