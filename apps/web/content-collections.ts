import { defineCollection, defineConfig } from "@content-collections/core"
import { compileMDX } from "@content-collections/mdx"
import GithubSlugger from "github-slugger"
import { fromHtml } from "hast-util-from-html"
import rehypeSlug from "rehype-slug"
import remarkGfm from "remark-gfm"
import type { Plugin } from "unified"
import { visit } from "unist-util-visit"
import { z } from "zod"
import { highlightDocsCode } from "./src/lib/highlight"

interface Heading extends Record<string, string | number> {
	id: string
	depth: 2 | 3
	text: string
}

type HastNode = {
	type: string
	tagName?: string
	value?: string
	properties?: Record<string, unknown>
	children?: HastNode[]
	data?: Record<string, unknown>
}

type ParentNode = HastNode & {
	children: HastNode[]
}

const codeFencePattern = /^```/u
const headingPattern = /^(#{2,3})\s+(.+?)\s*#*\s*$/u

function stripInlineMarkdown(value: string) {
	return value
		.replace(/`([^`]+)`/gu, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
		.replace(/[*_~]/gu, "")
		.replace(/<[^>]+>/gu, "")
		.trim()
}

function extractHeadings(content: string): Heading[] {
	const slugger = new GithubSlugger()
	const headings: Heading[] = []
	let insideFence = false

	for (const line of content.split(/\r?\n/u)) {
		if (codeFencePattern.test(line.trim())) {
			insideFence = !insideFence
			continue
		}

		if (insideFence) continue

		const match = line.match(headingPattern)
		if (!match) continue

		const text = stripInlineMarkdown(match[2])
		if (!text) continue

		headings.push({
			id: slugger.slug(text),
			depth: match[1].length as 2 | 3,
			text,
		})
	}

	return headings
}

function toSearchText(content: string) {
	return content
		.replace(/^```.*$/gmu, " ")
		.replace(/<[^>]+>/gu, " ")
		.replace(/[#*_`~[\](){}|>:-]+/gu, " ")
		.replace(/\s+/gu, " ")
		.trim()
		.toLowerCase()
}

function collectText(node: HastNode | undefined): string {
	if (!node) return ""
	if (node.type === "text") return node.value ?? ""
	return (node.children ?? []).map(collectText).join("")
}

function getCodeLanguage(codeNode: HastNode) {
	const classNames = codeNode.properties?.className
	if (!Array.isArray(classNames)) return undefined
	const languageClass = classNames.find(
		(className): className is string =>
			typeof className === "string" && className.startsWith("language-"),
	)
	return languageClass?.replace(/^language-/u, "")
}

function getCodeMeta(codeNode: HastNode) {
	const directMeta = codeNode.properties?.["data-code-meta"]
	if (typeof directMeta === "string") return directMeta
	return ""
}

function findHighlightedPre(html: string): HastNode | null {
	const fragment = fromHtml(html, { fragment: true }) as ParentNode
	const firstChild = fragment.children.find(
		(child) => child.type === "element" && child.tagName === "pre",
	)
	return firstChild ?? null
}

const remarkCodeMeta: Plugin = () => {
	return (tree) => {
		visit(tree, "code", (node: { meta?: string; data?: Record<string, unknown> }) => {
			node.data ??= {}
			const hProperties = {
				...((node.data.hProperties as Record<string, unknown> | undefined) ?? {}),
				"data-code-meta": node.meta ?? "",
			}
			node.data.hProperties = hProperties
		})
	}
}

const rehypeShikiCodeBlocks: Plugin = () => {
	return async (tree) => {
		const tasks: Promise<void>[] = []

		visit(tree, "element", (node: HastNode, index, parent: ParentNode | undefined) => {
			if (node.tagName !== "pre" || index === undefined || !parent?.children) return
			const codeNode = node.children?.find((child) => child.tagName === "code")
			if (!codeNode) return

			tasks.push(
				(async () => {
					const highlightedPre = findHighlightedPre(
						await highlightDocsCode(collectText(codeNode), getCodeLanguage(codeNode)),
					)
					if (!highlightedPre) return

					const meta = getCodeMeta(codeNode)
					highlightedPre.properties = {
						...(highlightedPre.properties ?? {}),
						"data-code-meta": meta,
					}
					parent.children[index] = highlightedPre
				})(),
			)
		})

		await Promise.all(tasks)
	}
}

const docs = defineCollection({
	name: "docs",
	directory: "src/content/docs",
	include: "**/*.mdx",
	schema: z.object({
		title: z.string(),
		description: z.string(),
		section: z.string(),
		sectionOrder: z.number().int().nonnegative(),
		order: z.number().int().nonnegative(),
		content: z.string(),
	}),
	transform: async (document, context) => {
		const headings = extractHeadings(document.content)
		const mdx = await compileMDX(context, document, {
			remarkPlugins: [remarkGfm, remarkCodeMeta],
			rehypePlugins: [rehypeSlug, rehypeShikiCodeBlocks],
		})
		const slug = document._meta.path
		const searchText = [
			document.title,
			document.description,
			document.section,
			...headings.map((heading) => heading.text),
			toSearchText(document.content),
		]
			.join(" ")
			.toLowerCase()

		return {
			title: document.title,
			description: document.description,
			section: document.section,
			sectionOrder: document.sectionOrder,
			order: document.order,
			content: document.content,
			slug,
			href: `/docs/${slug}`,
			headings,
			mdx,
			searchText,
		}
	},
})

export default defineConfig({
	content: [docs],
})
