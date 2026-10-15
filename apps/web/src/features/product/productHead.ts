import type { ProductSeo } from "../../content/product"
import { createSeoHead, pageTitle } from "../../seo/metadata"
import {
	breadcrumbSchema,
	jsonLdScripts,
	softwareApplicationSchema,
} from "../../seo/structuredData"

interface ProductHeadOptions {
	seo: ProductSeo
	name: string
	operatingSystem?: string
	applicationCategory?: string
	featureList?: readonly string[]
	price?: string
	isService?: boolean
}

export function createProductHead({
	seo,
	name,
	operatingSystem,
	applicationCategory,
	featureList,
	price,
	isService = false,
}: ProductHeadOptions) {
	return {
		...createSeoHead({ title: pageTitle(seo.title), description: seo.description, path: seo.path }),
		scripts: jsonLdScripts(
			softwareApplicationSchema({
				name,
				description: seo.description,
				path: seo.path,
				operatingSystem,
				applicationCategory,
				featureList,
				price,
				isPartOf: isService,
			}),
			breadcrumbSchema([
				{ name: "Cortex", path: "/" },
				{ name: seo.title, path: seo.path },
			]),
		),
	}
}
