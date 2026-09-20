import { protocol, net } from "electron"
import { pathToFileURL } from "node:url"

export function registerCortexFileProtocol(): void {
	protocol.handle("cortex-file", async (request) => {
		const url = new URL(request.url)
		let filePath = decodeURIComponent(url.pathname)
		if (url.hostname === "local") {
			filePath = decodeURIComponent(url.pathname)
		}
		if (process.platform === "win32" && filePath.startsWith("/")) {
			filePath = filePath.slice(1)
		}
		return net.fetch(pathToFileURL(filePath).toString())
	})
}

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
