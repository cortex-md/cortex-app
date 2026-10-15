import { acceptInviteToken, previewInvite, SyncError } from "@cortex/sync-api"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import {
	createSessionClient,
	isAuthFailure,
	resolveActiveSession,
	type SessionDependencies,
} from "./sync/api"

export type InviteRole = "admin" | "editor" | "owner" | "viewer" | "unknown"

export interface InviteDetails {
	vaultName: string
	inviterName: string
	role: InviteRole
	expiresAt: string | null
}

export type InvitePreviewResult =
	| { status: "unauthenticated"; redirectTo: string }
	| { status: "pending"; invite: InviteDetails; email: string }
	| { status: "expired" }
	| { status: "unavailable"; message: string }

export type AcceptInviteResult =
	| { ok: true; vaultName: string }
	| { ok: false; code: "unauthenticated"; redirectTo: string }
	| { ok: false; code: "expired" }
	| { ok: false; code: "failed"; message: string }

const tokenSchema = z.object({ token: z.string().trim().min(1).max(512) })

export function getInviteLoginPath(token: string) {
	return `/login?redirect=${encodeURIComponent(`/invite/${token}`)}`
}

function normalizeRole(role: string): InviteRole {
	const value = role.toLowerCase()
	if (value === "admin" || value === "editor" || value === "owner" || value === "viewer")
		return value
	return "unknown"
}

function isExpiredInviteError(error: unknown) {
	return (
		error instanceof SyncError &&
		(error.status === 404 || error.status === 410 || error.code === "invite_expired")
	)
}

function inviteErrorMessage(error: unknown) {
	if (
		error instanceof SyncError &&
		(error.status === 402 || error.code === "subscription_required")
	) {
		return "Joining a shared vault needs hosted Sync on your account."
	}
	return "Cortex Sync couldn’t load this invite. Try again in a moment."
}

export async function previewInviteFromAuthSession(
	token: string,
	dependencies: SessionDependencies = {},
): Promise<InvitePreviewResult> {
	const session = await resolveActiveSession(dependencies)
	if (!session) return { status: "unauthenticated", redirectTo: getInviteLoginPath(token) }

	const { api, getSession } = createSessionClient(session, dependencies)

	try {
		const preview = await previewInvite(api, token)
		return {
			status: "pending",
			email: getSession().email,
			invite: {
				vaultName: preview.vaultName,
				inviterName: preview.inviterName,
				role: normalizeRole(preview.role),
				expiresAt: preview.expiresAt || null,
			},
		}
	} catch (error) {
		if (isAuthFailure(error)) {
			dependencies.onSessionCleared?.()
			return { status: "unauthenticated", redirectTo: getInviteLoginPath(token) }
		}
		if (isExpiredInviteError(error)) return { status: "expired" }
		return { status: "unavailable", message: inviteErrorMessage(error) }
	}
}

export async function acceptInviteFromAuthSession(
	token: string,
	dependencies: SessionDependencies = {},
): Promise<AcceptInviteResult> {
	const session = await resolveActiveSession(dependencies)
	if (!session) return { ok: false, code: "unauthenticated", redirectTo: getInviteLoginPath(token) }

	const { api } = createSessionClient(session, dependencies)

	try {
		const accepted = await acceptInviteToken(api, token)
		return { ok: true, vaultName: accepted.vault.name }
	} catch (error) {
		if (isAuthFailure(error)) {
			dependencies.onSessionCleared?.()
			return { ok: false, code: "unauthenticated", redirectTo: getInviteLoginPath(token) }
		}
		if (isExpiredInviteError(error)) return { ok: false, code: "expired" }
		return { ok: false, code: "failed", message: inviteErrorMessage(error) }
	}
}

async function readSessionDependencies(): Promise<SessionDependencies> {
	const { clearAuthSessionCookies, readAuthSessionFromCookies, setAuthSessionCookies } =
		await import("./auth-cookies.server")

	return {
		onSessionCleared: clearAuthSessionCookies,
		onSessionRefreshed: setAuthSessionCookies,
		session: readAuthSessionFromCookies(),
	}
}

export const getInvitePreview = createServerFn({ method: "GET" })
	.validator(tokenSchema)
	.handler(async ({ data }) =>
		previewInviteFromAuthSession(data.token, await readSessionDependencies()),
	)

export const acceptInvite = createServerFn({ method: "POST" })
	.validator(tokenSchema)
	.handler(async ({ data }) =>
		acceptInviteFromAuthSession(data.token, await readSessionDependencies()),
	)
