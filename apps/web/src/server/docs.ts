import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

const DOCS_CACHE_SECONDS = 24 * 60 * 60

async function cacheDocsResponse() {
	const { cacheServerFnResponse } = await import("./cache.server")
	cacheServerFnResponse(DOCS_CACHE_SECONDS)
}

export const getDocsPage = createServerFn({ method: "GET" })
	.validator(z.object({ slug: z.string().max(200).optional() }))
	.handler(async ({ data }) => {
		const { docsNavigationSummary, getDocBySlug } = await import("../features/docs/registry")
		const page = getDocBySlug(data.slug)
		if (!page) return null
		await cacheDocsResponse()
		return { page, navigation: docsNavigationSummary }
	})

export const getDocsSearchEntries = createServerFn({ method: "GET" }).handler(async () => {
	const { docsSearchEntries } = await import("../features/docs/registry")
	await cacheDocsResponse()
	return docsSearchEntries
})

export const getDefaultDocSlug = createServerFn({ method: "GET" }).handler(async () => {
	const { defaultDoc } = await import("../features/docs/registry")
	await cacheDocsResponse()
	return defaultDoc?.slug ?? null
})
