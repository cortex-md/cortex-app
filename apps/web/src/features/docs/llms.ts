import { siteConfig } from "../../config/site"
import type { DocPage } from "./registry"
import { docs } from "./registry"

const frontmatterPattern = /^---\s*[\s\S]*?\s*---\s*/u

function getDocsUrl(href: string, origin = siteConfig.url) {
	return `${origin.replace(/\/$/u, "")}${href}`
}

function getLlmBody(page: DocPage) {
	return page.content.replace(frontmatterPattern, "").trim()
}

export function createDocLlmText(page: DocPage, origin = siteConfig.url) {
	return [
		`# ${page.title}`,
		"",
		page.description,
		"",
		`Source: ${getDocsUrl(page.href, origin)}`,
		`Section: ${page.section}`,
		"",
		getLlmBody(page),
	].join("\n")
}

export function createLlmsIndex(origin = siteConfig.url) {
	const lines = [
		"# Cortex Docs",
		"",
		`${siteConfig.description} Cortex is local-first, open source, and stores knowledge in plain Markdown files.`,
		"",
		`Full docs corpus: ${getDocsUrl("/docs/llms.txt", origin)}`,
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
