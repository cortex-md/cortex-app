import { pathToFileURL } from "node:url"
import { net, protocol } from "electron"
import { assertAllowedPath } from "./security"

export function registerPrivilegedSchemes(): void {
	protocol.registerSchemesAsPrivileged([
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
