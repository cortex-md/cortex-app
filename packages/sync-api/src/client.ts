import { expectOk } from "./errors"

export interface TokenProvider {
	getAccessToken(serverUrl: string): Promise<string | null>
	refreshAccessToken(serverUrl: string): Promise<string | null>
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface RequestOptions {
	json?: unknown
	body?: Uint8Array
	headers?: Record<string, string>
	signal?: AbortSignal
}

export function normalizeServerUrl(url: string): string {
	return url.trim().replace(/\/+$/, "").toLowerCase()
}

export function withQuery(
	path: string,
	params: Record<string, string | number | boolean | null | undefined>,
): string {
	const query = new URLSearchParams()
	for (const [key, value] of Object.entries(params)) {
		if (value !== null && value !== undefined) query.set(key, String(value))
	}
	const encoded = query.toString()
	return encoded ? `${path}?${encoded}` : path
}

export const segment = encodeURIComponent

export interface ApiClientOptions {
	deviceId?: string
	tokens?: TokenProvider
	fetch?: FetchLike
}

export class ApiClient {
	readonly serverUrl: string
	private readonly fetch: FetchLike

	constructor(
		serverUrl: string,
		private readonly options: ApiClientOptions,
	) {
		this.serverUrl = normalizeServerUrl(serverUrl)
		this.fetch = options.fetch ?? ((input, init) => fetch(input, init))
	}

	async request(method: string, path: string, options: RequestOptions = {}): Promise<Response> {
		const send = (token: string | null) => {
			const headers: Record<string, string> = { ...options.headers }
			if (this.options.deviceId) headers["X-Device-ID"] = this.options.deviceId
			if (token) headers.Authorization = `Bearer ${token}`
			let body: BodyInit | undefined
			if (options.json !== undefined) {
				headers["Content-Type"] = "application/json"
				body = JSON.stringify(options.json)
			} else if (options.body) {
				body = options.body as BodyInit
			}
			return this.fetch(`${this.serverUrl}${path}`, {
				method,
				headers,
				body,
				signal: options.signal,
			})
		}

		const tokens = this.options.tokens
		const response = await send((await tokens?.getAccessToken(this.serverUrl)) ?? null)
		if (response.status !== 401 || !tokens) return response
		const refreshed = await tokens.refreshAccessToken(this.serverUrl)
		if (!refreshed) return response
		await response.body?.cancel().catch(() => undefined)
		return await send(refreshed)
	}

	async send(
		method: string,
		path: string,
		label: string,
		options?: RequestOptions,
	): Promise<Response> {
		return await expectOk(await this.request(method, path, options), label)
	}

	async json<T>(method: string, path: string, label: string, options?: RequestOptions): Promise<T> {
		const response = await this.send(method, path, label, options)
		return (await response.json()) as T
	}
}
