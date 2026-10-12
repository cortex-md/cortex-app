import { tmpdir } from "node:os"
import { resolve, sep } from "node:path"
import type { IpcMainInvokeEvent } from "electron"
import { app } from "electron"
import { credentialsPath } from "./paths"
import { listRegisteredVaultPaths } from "./services/registry"

const grantedRoots = new Set<string>()
const EXTERNAL_PROTOCOLS = new Set(["https:", "http:", "mailto:"])

function isWithin(path: string, root: string): boolean {
	return path === root || path.startsWith(root.endsWith(sep) ? root : root + sep)
}

export function grantPath(path: string): void {
	grantedRoots.add(resolve(path))
}

function allowedRoots(): string[] {
	return [
		app.getPath("userData"),
		tmpdir(),
		...grantedRoots,
		...listRegisteredVaultPaths().map((path) => resolve(path)),
	]
}

export function assertAllowedPath(path: string): string {
	const resolved = resolve(path)
	if (resolved === resolve(credentialsPath())) {
		throw new Error(`Access denied: ${path}`)
	}
	if (!allowedRoots().some((root) => isWithin(resolved, root))) {
		throw new Error(`Access denied: ${path}`)
	}
	return resolved
}

let trustedOrigin: string | null = null

export function setTrustedRendererUrl(url: string): void {
	trustedOrigin = new URL(url).protocol === "file:" ? "file://" : new URL(url).origin
}

export function isTrustedUrl(url: string): boolean {
	if (!trustedOrigin) return false
	if (trustedOrigin === "file://") return url.startsWith("file://")
	try {
		return new URL(url).origin === trustedOrigin
	} catch {
		return false
	}
}

export function assertTrustedSender(event: IpcMainInvokeEvent): void {
	const frame = event.senderFrame
	if (!frame || frame !== event.sender.mainFrame || !isTrustedUrl(frame.url)) {
		throw new Error("Untrusted IPC sender")
	}
}

export function assertExternalUrl(url: string): string {
	const protocol = new URL(url).protocol
	if (!EXTERNAL_PROTOCOLS.has(protocol)) {
		throw new Error(`Blocked external URL protocol: ${protocol}`)
	}
	return url
}
