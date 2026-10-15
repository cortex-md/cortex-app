import { getRequest, setResponseHeader } from "@tanstack/react-start/server"

function cdnCacheControl(seconds: number) {
	return `public, s-maxage=${seconds}, stale-while-revalidate=86400`
}

export function cacheServerFnResponse(seconds: number) {
	try {
		if (!new URL(getRequest().url).pathname.startsWith("/_serverFn/")) return
		setResponseHeader("CDN-Cache-Control", cdnCacheControl(seconds))
		setResponseHeader("Cache-Control", "public, max-age=0, must-revalidate")
	} catch {}
}
