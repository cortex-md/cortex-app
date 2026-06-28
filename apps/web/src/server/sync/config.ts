const defaultSiteUrl = "https://cortex-md.tech"
const defaultSyncUrl = "http://localhost:8080"
const defaultBillingCompletionUrl = "cortex://sync/checkout-complete"

export interface SyncRuntimeEnv {
	CORTEX_BILLING_COMPLETION_URL?: string
	CORTEX_BILLING_RETURN_URL?: string
	CORTEX_SYNC_URL?: string
	SITE_URL?: string
}

export function normalizeHttpBaseUrl(value: string, fallback: string) {
	const rawValue = value.trim() || fallback

	try {
		const url = new URL(rawValue)
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			throw new Error("URL must use http or https.")
		}
		url.hash = ""
		url.search = ""
		return url.toString().replace(/\/+$/, "")
	} catch {
		return fallback
	}
}

export function getSyncBaseUrl(env: SyncRuntimeEnv = process.env) {
	return normalizeHttpBaseUrl(env.CORTEX_SYNC_URL ?? "", defaultSyncUrl)
}

export function getSiteBaseUrl(env: SyncRuntimeEnv = process.env) {
	return normalizeHttpBaseUrl(env.SITE_URL ?? "", defaultSiteUrl)
}

export function getBillingReturnUrl(env: SyncRuntimeEnv = process.env) {
	const configuredReturnUrl = env.CORTEX_BILLING_RETURN_URL?.trim()
	if (configuredReturnUrl) return configuredReturnUrl

	return `${getSiteBaseUrl(env)}/billing/cancelled`
}

export function getBillingCompletionUrl(env: SyncRuntimeEnv = process.env) {
	return env.CORTEX_BILLING_COMPLETION_URL?.trim() || defaultBillingCompletionUrl
}
