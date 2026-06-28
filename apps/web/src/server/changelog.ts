import { createServerFn } from "@tanstack/react-start"
import type { Nodes } from "hast"
import { fromHtml } from "hast-util-from-html"
import { toHtml } from "hast-util-to-html"
import rehypeSlug from "rehype-slug"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { type Plugin, unified } from "unified"
import { visit } from "unist-util-visit"
import { z } from "zod"
import { highlightDocsCode } from "../lib/highlight"

const GITHUB_RELEASES_URL = "https://api.github.com/repos/cortex-md/cortex.md/releases?per_page=20"
const GITHUB_API_VERSION = "2022-11-28"
const GITHUB_USER_AGENT = "Cortex website changelog"
const CACHE_TTL_MS = 5 * 60 * 1000

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

const githubReleaseSchema = z.object({
	tag_name: z.string(),
	name: z.string().nullable().optional(),
	body: z.string().nullable().optional(),
	html_url: z.string().url().optional(),
	published_at: z.string().nullable().optional(),
	prerelease: z.boolean().optional(),
	draft: z.boolean().optional(),
})

const githubReleasesSchema = z.array(githubReleaseSchema)

export type GithubRelease = z.infer<typeof githubReleaseSchema>

export interface ChangelogRelease {
	tagName: string
	version: string
	title: string
	url: string
	publishedAt: string
	formattedDate: string
	bodyMarkdown: string
	bodyHtml: string
}

export interface ChangelogResult {
	status: "ok" | "empty" | "unavailable"
	releases: ChangelogRelease[]
	message: string
	isStale?: boolean
}

interface CachedChangelog {
	expiresAt: number
	result: ChangelogResult
}

let cachedChangelog: CachedChangelog | undefined

function isStablePublicRelease(release: GithubRelease) {
	return !release.draft && !release.prerelease
}

export function normalizeReleaseVersion(tagName: string) {
	return tagName.trim().replace(/^v/iu, "")
}

function normalizeComparableTitle(value: string) {
	return value
		.replace(/`([^`]+)`/gu, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
		.replace(/[*_~#]/gu, "")
		.replace(/\s+/gu, " ")
		.trim()
		.toLowerCase()
}

function stripLeadingHeading(value: string) {
	return value.replace(/^#\s+(.+?)\s*#*\s*(?:\r?\n|$)/u, "").trim()
}

export function stripDuplicateReleaseTitle(
	markdown: string,
	releaseTitle: string,
	tagName: string,
) {
	const trimmed = markdown.trim()
	const match = trimmed.match(/^#\s+(.+?)\s*#*\s*(?:\r?\n|$)/u)
	if (!match) return trimmed

	const version = normalizeReleaseVersion(tagName)
	const normalizedHeading = normalizeComparableTitle(match[1])
	const duplicateCandidates = [
		releaseTitle,
		tagName,
		version,
		`v${version}`,
		`Cortex ${version}`,
		`Cortex v${version}`,
		`What's new in Cortex ${version}`,
		`What's new in Cortex v${version}`,
	].map(normalizeComparableTitle)

	return duplicateCandidates.includes(normalizedHeading) ? stripLeadingHeading(trimmed) : trimmed
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

function readStringProperty(value: unknown) {
	if (typeof value === "string") return value
	if (typeof value === "number") return String(value)
	return undefined
}

function sanitizeUrl(value: unknown, allowedProtocols: readonly string[]) {
	const raw = readStringProperty(value)?.trim()
	if (!raw) return undefined
	if (raw.startsWith("#")) return raw

	try {
		const url = new URL(raw)
		return allowedProtocols.includes(url.protocol) ? url.toString() : undefined
	} catch {
		return undefined
	}
}

function removeUnsafeProperties(properties: Record<string, unknown>) {
	for (const key of Object.keys(properties)) {
		if (/^on/iu.test(key) || key === "style" || key === "srcSet") {
			delete properties[key]
		}
	}
}

const rehypeHardenReleaseHtml: Plugin = () => {
	return (tree) => {
		visit(tree, "element", (node: HastNode) => {
			node.properties ??= {}
			removeUnsafeProperties(node.properties)

			if (node.tagName === "a") {
				const href = sanitizeUrl(node.properties.href, ["http:", "https:", "mailto:"])
				if (href) {
					node.properties.href = href
					if (/^https?:/iu.test(href)) {
						node.properties.target = "_blank"
						node.properties.rel = "noreferrer"
					}
				} else {
					delete node.properties.href
				}
			}

			if (node.tagName === "img") {
				const src = sanitizeUrl(node.properties.src, ["http:", "https:"])
				if (src) {
					node.properties.src = src
					node.properties.loading = "lazy"
					node.properties.decoding = "async"
					node.properties.className = ["changelog-release-image"]
				} else {
					delete node.properties.src
				}
			}
		})
	}
}

export async function renderReleaseMarkdown(markdown: string) {
	const processor = unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkCodeMeta)
		.use(remarkRehype)
		.use(rehypeSlug)
		.use(rehypeShikiCodeBlocks)
		.use(rehypeHardenReleaseHtml)

	const mdast = processor.parse(markdown)
	const hast = await processor.run(mdast)
	return toHtml(hast as Nodes)
}

function formatReleaseDate(isoDate: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(isoDate))
}

export async function mapGithubRelease(release: GithubRelease): Promise<ChangelogRelease | null> {
	if (!isStablePublicRelease(release)) return null

	const tagName = release.tag_name.trim()
	const publishedAt = release.published_at?.trim()
	if (!tagName || !publishedAt || Number.isNaN(Date.parse(publishedAt))) return null

	const version = normalizeReleaseVersion(tagName)
	const releaseName = release.name?.trim()
	const title = releaseName && releaseName !== tagName ? releaseName : `Cortex ${version}`
	const bodyMarkdown = stripDuplicateReleaseTitle(release.body ?? "", title, tagName)
	const bodyHtml = await renderReleaseMarkdown(
		bodyMarkdown || "No release notes were published for this version.",
	)

	return {
		tagName,
		version,
		title,
		url: release.html_url ?? `https://github.com/cortex-md/cortex.md/releases/tag/${tagName}`,
		publishedAt,
		formattedDate: formatReleaseDate(publishedAt),
		bodyMarkdown,
		bodyHtml,
	}
}

function emptyResult(message: string): ChangelogResult {
	return {
		status: "empty",
		releases: [],
		message,
	}
}

function unavailableResult(message: string): ChangelogResult {
	return {
		status: "unavailable",
		releases: [],
		message,
	}
}

export async function fetchChangelogReleases(
	fetcher: typeof fetch = fetch,
): Promise<ChangelogResult> {
	try {
		const response = await fetcher(GITHUB_RELEASES_URL, {
			headers: {
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": GITHUB_API_VERSION,
				"User-Agent": GITHUB_USER_AGENT,
			},
		})

		if (response.status === 404) {
			return emptyResult("No public stable release notes are available yet.")
		}

		if (!response.ok) {
			return unavailableResult("Release notes are temporarily unavailable.")
		}

		const parsed = githubReleasesSchema.safeParse(await response.json())
		if (!parsed.success) {
			return unavailableResult("Release notes are temporarily unavailable.")
		}

		const releases = (await Promise.all(parsed.data.map((release) => mapGithubRelease(release))))
			.filter((release): release is ChangelogRelease => Boolean(release))
			.sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))

		if (releases.length === 0) {
			return emptyResult("No public stable release notes are available yet.")
		}

		return {
			status: "ok",
			releases,
			message: "Stable public release notes loaded.",
		}
	} catch {
		return unavailableResult("Release notes are temporarily unavailable.")
	}
}

async function fetchCachedChangelogReleases() {
	const now = Date.now()
	if (cachedChangelog && cachedChangelog.expiresAt > now) {
		return cachedChangelog.result
	}

	const nextResult = await fetchChangelogReleases()
	if (nextResult.status === "unavailable" && cachedChangelog) {
		return {
			...cachedChangelog.result,
			isStale: true,
			message: "Showing the latest cached release notes while GitHub is unavailable.",
		}
	}

	cachedChangelog = {
		result: nextResult,
		expiresAt: now + CACHE_TTL_MS,
	}
	return nextResult
}

export const getChangelogReleases = createServerFn({ method: "GET" }).handler(() =>
	fetchCachedChangelogReleases(),
)
