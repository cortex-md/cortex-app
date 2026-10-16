import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { extname, resolve, sep } from "node:path"
import { Readable } from "node:stream"
import { pathToFileURL } from "node:url"
import { net, protocol } from "electron"
import { assertAllowedPath } from "./security"

export const APP_SCHEME = "cortex-app"
export const APP_HOST = "app"

const APP_CONTENT_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".cjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".map": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".otf": "font/otf",
	".wasm": "application/wasm",
	".txt": "text/plain; charset=utf-8",
}

export function registerPrivilegedSchemes(): void {
	protocol.registerSchemesAsPrivileged([
		{
			scheme: APP_SCHEME,
			privileges: {
				standard: true,
				secure: true,
				supportFetchAPI: true,
				corsEnabled: true,
				stream: true,
				codeCache: true,
			},
		},
		{
			scheme: "cortex-file",
			privileges: {
				standard: true,
				secure: true,
				supportFetchAPI: true,
				corsEnabled: true,
				stream: true,
			},
		},
	])
}

export function appUrl(path: string): string {
	return `${APP_SCHEME}://${APP_HOST}/${path.replace(/^\/+/, "")}`
}

function resolveAppFile(rendererRoot: string, pathname: string): string | null {
	const relativePath = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html"
	const filePath = resolve(rendererRoot, relativePath)
	const root = rendererRoot.endsWith(sep) ? rendererRoot : rendererRoot + sep
	return filePath.startsWith(root) ? filePath : null
}

export function registerAppProtocol(rendererRoot: string): void {
	const root = resolve(rendererRoot)
	protocol.handle(APP_SCHEME, async (request) => {
		const url = new URL(request.url)
		if (url.host !== APP_HOST) return new Response(null, { status: 404 })
		const filePath = resolveAppFile(root, url.pathname)
		if (!filePath) return new Response(null, { status: 403 })
		try {
			const info = await stat(filePath)
			if (!info.isFile()) return new Response(null, { status: 404 })
			const headers: Record<string, string> = {
				"Content-Length": String(info.size),
				"Content-Type":
					APP_CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream",
			}
			return new Response(Readable.toWeb(createReadStream(filePath)) as ReadableStream, {
				status: 200,
				headers,
			})
		} catch {
			return new Response(null, { status: 404 })
		}
	})
}

export function registerCortexFileProtocol(): void {
	protocol.handle("cortex-file", async (request) => {
		const pathname = decodeURIComponent(new URL(request.url).pathname)
		const filePath = process.platform === "win32" ? pathname.replace(/^\//, "") : pathname
		let allowedPath: string
		try {
			allowedPath = assertAllowedPath(filePath)
		} catch {
			return new Response(null, { status: 403 })
		}
		return await net.fetch(pathToFileURL(allowedPath).toString())
	})
}
