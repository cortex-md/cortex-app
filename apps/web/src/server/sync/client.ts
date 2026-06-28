import { getSyncBaseUrl, type SyncRuntimeEnv } from "./config"

export interface SyncErrorPayload {
	code?: string
	error?: string
}

export class SyncApiError extends Error {
	code?: string
	status: number

	constructor({ code, message, status }: { code?: string; message: string; status: number }) {
		super(message)
		this.name = "SyncApiError"
		this.code = code
		this.status = status
	}
}

export interface SyncRequestOptions {
	accessToken?: string
	body?: unknown
	deviceId?: string
	env?: SyncRuntimeEnv
	fetcher?: typeof fetch
	method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT"
}

async function readSyncPayload(response: Response) {
	if (response.status === 204) return null

	try {
		return (await response.json()) as unknown
	} catch {
		return null
	}
}

export async function syncRequest<T>(path: string, options: SyncRequestOptions = {}) {
	const fetcher = options.fetcher ?? fetch
	const headers: Record<string, string> = {
		Accept: "application/json",
	}

	if (options.body !== undefined) headers["Content-Type"] = "application/json"
	if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`
	if (options.deviceId) headers["X-Device-ID"] = options.deviceId

	const response = await fetcher(`${getSyncBaseUrl(options.env)}${path}`, {
		method: options.method ?? "GET",
		headers,
		body: options.body === undefined ? undefined : JSON.stringify(options.body),
	})
	const payload = await readSyncPayload(response)

	if (!response.ok) {
		const errorPayload = payload as SyncErrorPayload | null
		throw new SyncApiError({
			status: response.status,
			code: errorPayload?.code,
			message: errorPayload?.error || "Cortex Sync is temporarily unavailable.",
		})
	}

	return payload as T
}
