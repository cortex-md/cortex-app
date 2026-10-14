import { z } from "zod"
import { type RoadmapItem, type RoadmapResult, roadmapLabels } from "../content/roadmap"
import { withCache } from "./cache"
import { githubApiHeaders, githubFetch, githubRepo } from "./github"

const GITHUB_ROADMAP_URL = `https://api.github.com/repos/${githubRepo}/issues?labels=${encodeURIComponent(roadmapLabels.roadmap)}&state=all&per_page=100`
const GITHUB_USER_AGENT = "Cortex website roadmap"
export const ROADMAP_CACHE_SECONDS = 300
const DESCRIPTION_LIMIT = 220

const githubIssueSchema = z.object({
	number: z.number(),
	title: z.string(),
	body: z.string().nullable().optional(),
	html_url: z.string().url(),
	state: z.enum(["open", "closed"]),
	state_reason: z.string().nullable().optional(),
	created_at: z.string(),
	closed_at: z.string().nullable().optional(),
	comments: z.number().optional(),
	pull_request: z.unknown().optional(),
	labels: z.array(z.union([z.string(), z.object({ name: z.string().optional() })])).optional(),
	milestone: z.object({ title: z.string() }).nullable().optional(),
	reactions: z.object({ "+1": z.number().optional() }).optional(),
})

const githubIssuesSchema = z.array(githubIssueSchema)

export type GithubIssue = z.infer<typeof githubIssueSchema>

function labelNames(issue: GithubIssue) {
	return (issue.labels ?? [])
		.map((label) => (typeof label === "string" ? label : (label.name ?? "")))
		.filter(Boolean)
}

function stripInlineMarkdown(text: string) {
	return text
		.replace(/!\[[^\]]*\]\([^)]*\)/gu, "")
		.replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
		.replace(/[*_`~]+/gu, "")
		.replace(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ x]\]\s+)?/gmu, "")
		.replace(/^>\s?/gmu, "")
		.replace(/\s+/gu, " ")
		.trim()
}

export function summarizeIssueBody(body: string | null | undefined) {
	if (!body) return ""

	const blocks = body
		.replace(/<!--[\s\S]*?-->/gu, "")
		.replace(/\r\n/gu, "\n")
		.split(/\n{2,}/u)
		.map((block) => block.trim())
		.filter((block) => block && !block.startsWith("#") && !block.startsWith("```"))
		.map(stripInlineMarkdown)
		.filter((block) => block && block !== "No response")

	const summary = blocks[0] ?? ""
	if (summary.length <= DESCRIPTION_LIMIT) return summary

	const cut = summary.slice(0, DESCRIPTION_LIMIT)
	return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : DESCRIPTION_LIMIT)}…`
}

export function mapRoadmapIssue(issue: GithubIssue): RoadmapItem | null {
	if (issue.pull_request) return null

	const labels = labelNames(issue)
	const lowerLabels = labels.map((label) => label.toLowerCase())
	let status: RoadmapItem["status"]
	if (issue.state === "closed") {
		if (issue.state_reason !== "completed") return null
		status = "shipped"
	} else if (lowerLabels.includes(roadmapLabels.inProgress)) {
		status = "in-progress"
	} else {
		status = "planned"
	}

	const areaLabel = labels.find((label) => label.toLowerCase().startsWith(roadmapLabels.areaPrefix))
	const milestone = issue.milestone?.title.trim()

	return {
		number: issue.number,
		title: issue.title.trim(),
		description: summarizeIssueBody(issue.body),
		url: issue.html_url,
		status,
		area: areaLabel ? areaLabel.slice(roadmapLabels.areaPrefix.length).trim() : null,
		release: status === "shipped" && milestone && /^v\d/u.test(milestone) ? milestone : null,
		votes: issue.reactions?.["+1"] ?? 0,
		comments: issue.comments ?? 0,
		createdAt: issue.created_at,
		closedAt: issue.closed_at ?? null,
	}
}

export async function fetchRoadmapItems(fetcher: typeof fetch = fetch): Promise<RoadmapResult> {
	try {
		const response = await fetcher(GITHUB_ROADMAP_URL, {
			headers: githubApiHeaders(GITHUB_USER_AGENT),
		})
		if (!response.ok) return { status: "unavailable", items: [] }

		const parsed = githubIssuesSchema.safeParse(await response.json())
		if (!parsed.success) return { status: "unavailable", items: [] }

		const items = parsed.data
			.map(mapRoadmapIssue)
			.filter((item): item is RoadmapItem => Boolean(item))
		return { status: items.length > 0 ? "ok" : "empty", items }
	} catch {
		return { status: "unavailable", items: [] }
	}
}

export async function fetchCachedRoadmapItems(): Promise<RoadmapResult> {
	const cached = await withCache({
		key: "roadmap",
		ttlSeconds: ROADMAP_CACHE_SECONDS,
		tags: ["roadmap"],
		load: async () => {
			const result = await fetchRoadmapItems(githubFetch)
			return result.status === "unavailable" ? null : result
		},
	})
	if (!cached) return { status: "unavailable", items: [] }
	return cached.isStale ? { ...cached.value, isStale: true } : cached.value
}
