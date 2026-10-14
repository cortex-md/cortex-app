import { z } from "zod"
import { withCache } from "./cache"
import { renderReleaseMarkdown } from "./changelog"
import { githubApiHeaders, githubFetch } from "./github"

const GITHUB_USER_AGENT = "Cortex website marketplace"
export const DISCUSSION_CACHE_SECONDS = 300
const VISIBLE_COMMENTS = 10
const maintainerAssociations = new Set(["OWNER", "MEMBER", "COLLABORATOR"])

const githubCommentSchema = z.object({
	id: z.number(),
	html_url: z.string().url(),
	body: z.string().nullable().optional(),
	created_at: z.string(),
	author_association: z.string().optional(),
	child_comment_count: z.number().optional(),
	user: z
		.object({
			login: z.string(),
			html_url: z.string().url(),
			avatar_url: z.string().url(),
		})
		.nullable()
		.optional(),
})

const githubDiscussionSchema = z.object({ comments: z.number() })

export interface DiscussionComment {
	id: number
	url: string
	author: string
	authorUrl: string | null
	avatarUrl: string | null
	isMaintainer: boolean
	bodyHtml: string
	createdAt: string
	replies: number
}

export interface DiscussionCommentsResult {
	status: "ok" | "unavailable"
	total: number
	comments: DiscussionComment[]
}

function sizedAvatar(avatarUrl: string) {
	const url = new URL(avatarUrl)
	url.searchParams.set("s", "64")
	return url.toString()
}

async function fetchGithubJson(url: string, fetcher: typeof fetch) {
	const response = await fetcher(url, {
		headers: githubApiHeaders(GITHUB_USER_AGENT),
		signal: AbortSignal.timeout(8000),
	})
	if (!response.ok) throw new Error(`GitHub responded ${response.status}`)
	return response.json()
}

export async function fetchDiscussionComments(
	repo: string,
	number: number,
	fetcher: typeof fetch = fetch,
): Promise<DiscussionCommentsResult> {
	try {
		const base = `https://api.github.com/repos/${repo}/discussions/${number}`
		const discussion = githubDiscussionSchema.parse(await fetchGithubJson(base, fetcher))
		if (discussion.comments === 0) return { status: "ok", total: 0, comments: [] }

		const comments = z
			.array(githubCommentSchema)
			.parse(await fetchGithubJson(`${base}/comments?per_page=100`, fetcher))
		const latest = comments.slice(-VISIBLE_COMMENTS).reverse()

		return {
			status: "ok",
			total: discussion.comments,
			comments: await Promise.all(
				latest.map(async (comment) => ({
					id: comment.id,
					url: comment.html_url,
					author: comment.user?.login ?? "ghost",
					authorUrl: comment.user?.html_url ?? null,
					avatarUrl: comment.user ? sizedAvatar(comment.user.avatar_url) : null,
					isMaintainer: maintainerAssociations.has(comment.author_association ?? ""),
					bodyHtml: await renderReleaseMarkdown(comment.body ?? ""),
					createdAt: comment.created_at,
					replies: comment.child_comment_count ?? 0,
				})),
			),
		}
	} catch {
		return { status: "unavailable", total: 0, comments: [] }
	}
}

export async function fetchCachedDiscussionComments(
	repo: string,
	number: number,
): Promise<DiscussionCommentsResult> {
	const cached = await withCache({
		key: `discussion:${repo}#${number}`,
		ttlSeconds: DISCUSSION_CACHE_SECONDS,
		tags: ["marketplace", `discussion:${repo}#${number}`],
		load: async () => {
			const result = await fetchDiscussionComments(repo, number, githubFetch)
			return result.status === "unavailable" ? null : result
		},
	})
	return cached?.value ?? { status: "unavailable", total: 0, comments: [] }
}
