import { describe, expect, it } from "vitest"
import { siteConfig } from "../config/site"
import { createHomeHead } from "./home"

describe("createHomeHead", () => {
	it("includes canonical, social metadata, and all JSON-LD schemas", () => {
		const head = createHomeHead()

		expect(head.links).toContainEqual({ rel: "canonical", href: siteConfig.url })
		expect(head.meta).toContainEqual({ name: "description", content: siteConfig.description })
		expect(head.meta).toContainEqual({ property: "og:image", content: siteConfig.ogImage })

		const schemas = head.scripts.map((script) => JSON.parse(script.children))
		expect(schemas.map((schema) => schema["@type"])).toEqual([
			"SoftwareApplication",
			"Organization",
			"WebSite",
			"FAQPage",
		])
		expect(schemas[1].sameAs).toEqual([siteConfig.githubUrl])
	})
})
