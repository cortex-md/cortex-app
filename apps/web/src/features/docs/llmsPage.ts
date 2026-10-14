import { siteConfig } from "../../config/site"
import type { DocPage } from "./registry"

const frontmatterPattern = /^---\s*[\s\S]*?\s*---\s*/u

export function getDocsUrl(href: string, origin = siteConfig.url) {
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
