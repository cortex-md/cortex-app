import type { SubscriptionBlockCode } from "@cortex/platform"

export type SyncErrorKind = "transient" | "permanent" | "auth" | "forbidden" | "subscription"

interface ErrorBody {
	code: string | null
	detail: string | null
}

function parseErrorBody(body: string): ErrorBody {
	try {
		const parsed = JSON.parse(body) as { code?: unknown; error?: unknown; message?: unknown }
		const detail = parsed.error ?? parsed.message
		return {
			code: typeof parsed.code === "string" ? parsed.code : null,
			detail: typeof detail === "string" && detail.trim() ? detail.trim() : null,
		}
	} catch {
		return { code: null, detail: null }
	}
}

function kindForStatus(status: number): SyncErrorKind {
	if (status === 401) return "auth"
	if (status === 403) return "forbidden"
	if (status === 429 || status >= 500 || status < 400) return "transient"
	return "permanent"
}

export class SyncError extends Error {
	constructor(
		readonly kind: SyncErrorKind,
		message: string,
		readonly status: number | null = null,
		readonly code: string | null = null,
		readonly detail: string | null = null,
	) {
		super(message)
		this.name = "SyncError"
	}

	get isRetriable(): boolean {
		return this.kind === "transient"
	}

	get blockCode(): SubscriptionBlockCode | null {
		return this.kind === "subscription" ? (this.code as SubscriptionBlockCode) : null
	}

	static fromStatus(status: number, message: string, body = ""): SyncError {
		const blockCode = subscriptionCode(status, body)
		if (blockCode) return new SyncError("subscription", message, status, blockCode)
		const { code, detail } = parseErrorBody(body)
		return new SyncError(kindForStatus(status), message, status, code, detail)
	}
}

export function subscriptionCode(status: number, body: string): SubscriptionBlockCode | null {
	if (status < 400 || status >= 500) return null
	const text = body.toLowerCase()
	if (text.includes("subscription_expired") || text.includes("plan has expired")) {
		return "subscription_expired"
	}
	if (
		status === 402 ||
		text.includes("subscription_required") ||
		text.includes("plan is required")
	) {
		return "subscription_required"
	}
	return null
}

export function subscriptionAccessMessage(code: SubscriptionBlockCode | null): string {
	if (code === "subscription_expired") {
		return "Your Cortex Cloud plan has expired. Renew your plan to resume sync."
	}
	return "A Cortex Cloud plan is required to sync with Cortex Cloud."
}

export async function expectOk(response: Response, label: string): Promise<Response> {
	if (response.ok) return response
	const body = await response.text().catch(() => "")
	throw SyncError.fromStatus(
		response.status,
		`${label} failed: HTTP ${response.status}: ${body}`,
		body,
	)
}

export function isRetriable(error: unknown): boolean {
	return error instanceof SyncError ? error.isRetriable : true
}
