import type { Platform } from "@cortex/platform"

export const httpApi = {
	download: async (url) => {
		const response = await fetch(url)

		if (!response.ok) {
			throw new Error(`HTTP ${response.status} while downloading ${url}`)
		}

		return response.text()
	},
	fetch: (url, options) => fetch(url, options),
} satisfies Platform["http"]
