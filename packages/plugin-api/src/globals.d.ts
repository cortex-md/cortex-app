/** Minimal console surface available to plugin bundles without depending on DOM or Node types. */
declare var console: {
	log(...args: unknown[]): void
	warn(...args: unknown[]): void
	error(...args: unknown[]): void
	info(...args: unknown[]): void
	debug(...args: unknown[]): void
}

/** Host-compatible timer helper. */
declare function setTimeout(callback: () => void, ms?: number): number
/** Host-compatible timer cleanup helper. */
declare function clearTimeout(id: number): void
/** Host-compatible repeating timer helper. */
declare function setInterval(callback: () => void, ms?: number): number
/** Host-compatible repeating timer cleanup helper. */
declare function clearInterval(id: number): void
/** Minimal fetch surface for plugin bundles that do not include DOM lib types. */
declare function fetch(
	input: string,
	init?: {
		method?: string
		headers?: Record<string, string>
		body?: string
	},
): Promise<{
	ok: boolean
	status: number
	json(): Promise<unknown>
	text(): Promise<string>
}>
