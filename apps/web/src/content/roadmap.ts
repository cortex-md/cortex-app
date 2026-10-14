export type RoadmapStatus = "shipped" | "in-progress" | "planned"

export type RoadmapSort = "votes" | "newest"

export interface RoadmapItem {
	number: number
	title: string
	description: string
	url: string
	status: RoadmapStatus
	area: string | null
	release: string | null
	votes: number
	comments: number
	createdAt: string
	closedAt: string | null
}

export interface RoadmapResult {
	status: "ok" | "empty" | "unavailable"
	items: RoadmapItem[]
	isStale?: boolean
}

export const roadmapLabels = {
	roadmap: "roadmap",
	inProgress: "status: in progress",
	areaPrefix: "area: ",
} as const

export const roadmapColumns: ReadonlyArray<{ id: RoadmapStatus; title: string }> = [
	{ id: "shipped", title: "Shipped" },
	{ id: "in-progress", title: "In progress" },
	{ id: "planned", title: "Planned" },
]

export const roadmapSorts: ReadonlyArray<{ id: RoadmapSort; label: string }> = [
	{ id: "votes", label: "Most votes" },
	{ id: "newest", label: "Newest" },
]

export const roadmapCopy = {
	title: "What has shipped, what is in motion,",
	titleQuiet: "and what is next.",
	lead: "Every card is a GitHub issue. Vote with a thumbs up on the issue and the most wanted work rises to the top.",
	description:
		"The Cortex roadmap, read live from GitHub issues. See what shipped, what is in progress, and vote on what comes next.",
	issuesLink: "See the roadmap on GitHub",
	ideasLink: "Browse open ideas",
	filterLabel: "Filter by area",
	sortLabel: "Sort",
	allAreas: "All",
	otherArea: "Other",
	viewIssue: (number: number) => `#${number}`,
	votes: (count: number) => `${count} ${count === 1 ? "vote" : "votes"}. Vote on GitHub`,
	shippedIn: (release: string) => `Shipped in ${release}`,
	empty: "Nothing in this area yet.",
	emptyTitle: "The roadmap is empty for now",
	emptyDescription:
		"No issue carries the roadmap label yet. Ideas you open on GitHub land here once they are triaged.",
	unavailableTitle: "The roadmap is unavailable right now",
	unavailableDescription: "GitHub did not answer. The same issues are on GitHub.",
	stale: "Showing a cached copy while GitHub is unavailable.",
	ideaTitle: "Missing something?",
	ideaDescription:
		"Search the open ideas first and vote with a thumbs up. If nobody asked yet, suggest it on GitHub.",
	ideaCta: "Suggest an idea",
} as const

const repoUrl = "https://github.com/cortex-md/cortex-app"

export const roadmapLinks = {
	roadmapIssues: `${repoUrl}/issues?q=${encodeURIComponent(`is:issue label:${roadmapLabels.roadmap}`)}`,
	ideas: `${repoUrl}/issues?q=${encodeURIComponent("is:issue is:open label:enhancement sort:reactions-+1-desc")}`,
	suggestIdea: `${repoUrl}/issues/new?template=feature_request.yml`,
	release: (tag: string) => `${repoUrl}/releases/tag/${tag}`,
} as const
