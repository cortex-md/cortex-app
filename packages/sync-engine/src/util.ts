import type { SubscriptionBlockCode, SyncAccessDeniedKind } from "@cortex/platform"
import { SyncError, subscriptionAccessMessage } from "@cortex/sync-api"
import { syncRuntime } from "./runtime"

export function normalizeSlashes(path: string): string {
	return path.replaceAll("\\", "/")
}

export function normalizeRelativePath(path: string): string {
	return normalizeSlashes(path).replace(/^\/+/, "")
}

export function resolveInVault(vaultPath: string, relativePath: string): string {
	const { isAbsolute, relative, resolve } = syncRuntime().path
	const normalized = normalizeSlashes(relativePath)
	if (
		!normalized ||
		normalized.includes("\0") ||
		normalized.startsWith("/") ||
		/^[a-zA-Z]:/.test(normalized) ||
		isAbsolute(relativePath)
	) {
		throw new SyncError("permanent", `Rejected unsafe sync path: ${relativePath}`)
	}
	const root = resolve(vaultPath)
	const target = resolve(root, normalized)
	const fromRoot = relative(root, target)
	if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
		throw new SyncError("permanent", `Rejected sync path outside the vault: ${relativePath}`)
	}
	return target
}

export function nowSeconds(): number {
	return Math.floor(Date.now() / 1000)
}

export async function writeFileAtomic(path: string, content: Uint8Array): Promise<void> {
	const { fs, path: paths, randomUUID } = syncRuntime()
	await fs.mkdir(paths.dirname(path))
	const temporaryPath = `${path}.${randomUUID()}.tmp`
	try {
		await fs.writeFile(temporaryPath, content)
		await fs.rename(temporaryPath, path)
	} catch (error) {
		await fs.rm(temporaryPath)
		throw error
	}
}

export interface AccessDenial {
	reason: string
	kind: SyncAccessDeniedKind
	code: SubscriptionBlockCode | null
}

export type AccessScope = "vault" | "path"

export function isPathForbidden(error: unknown): boolean {
	return error instanceof SyncError && error.kind === "forbidden"
}

export function accessDenial(error: unknown, scope: AccessScope = "vault"): AccessDenial | null {
	if (!(error instanceof SyncError)) return null
	if (error.kind === "subscription") {
		return {
			reason: subscriptionAccessMessage(error.blockCode),
			kind: "subscription",
			code: error.blockCode,
		}
	}
	if (scope === "vault" && error.kind === "forbidden" && error.code !== "insufficient_role") {
		return { reason: error.message, kind: "vault", code: null }
	}
	return null
}

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

export async function runPool<T>(
	items: readonly T[],
	concurrency: number,
	worker: (item: T) => Promise<void>,
): Promise<void> {
	let next = 0
	let failed = false
	const lane = async () => {
		while (!failed && next < items.length) {
			const item = items[next] as T
			next += 1
			try {
				await worker(item)
			} catch (error) {
				failed = true
				throw error
			}
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane))
}
