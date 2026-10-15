import { siteConfig } from "../../config/site"
import { llmsProductPages } from "../../content/docs"
import { createDocLlmText, getDocsUrl } from "./llmsPage"
import { docs } from "./registry"

export { createDocLlmText }

export function createLlmsIndex(origin = siteConfig.url) {
	const lines = [
		"# Cortex Docs",
		"",
		`${siteConfig.description} Cortex is local-first, open source, and stores knowledge in plain Markdown files.`,
		"",
		`Full docs corpus: ${getDocsUrl("/docs/llms.txt", origin)}`,
		"",
		"## Product",
		"",
		...llmsProductPages.map(
			(page) => `- [${page.title}](${getDocsUrl(page.href, origin)}): ${page.description}`,
		),
		"",
		"## Documentation",
		"",
		...docs.map(
			(page) => `- [${page.title}](${getDocsUrl(page.href, origin)}): ${page.description}`,
		),
	]

	return `${lines.join("\n")}\n`
}

export function createDocsLlmCorpus(origin = siteConfig.url) {
	const intro = [
		"# Cortex Documentation",
		"",
		"LLM-readable documentation corpus for Cortex.",
		"",
		`Canonical index: ${getDocsUrl("/llms.txt", origin)}`,
	].join("\n")

	return `${intro}\n\n${docs.map((page) => createDocLlmText(page, origin)).join("\n\n---\n\n")}\n`
}
