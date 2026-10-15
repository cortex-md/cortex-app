export const changelogCopy = {
	title: "Changelog",
	lead: "What changed in each version of Cortex. Every entry comes from a release on GitHub.",
	description:
		"Release notes for every stable version of Cortex, taken from the releases on GitHub.",
	rss: "RSS",
	watch: "Watch releases",
	filterLabel: "Show",
	latest: "Latest",
	newLabel: "New",
	fixedLabel: "Fixed",
	downloads: "Downloads",
	viewOnGitHub: (tag: string) => `View ${tag} on GitHub`,
	filteredEmpty: "No releases match this filter.",
	emptyTitle: "No public stable release notes yet",
	unavailableTitle: "Release notes are unavailable right now",
	readDocs: "Read the docs",
	tryAgain: "Try again",
	feedTitle: "Cortex releases",
} as const

export const changelogFilters = ["All", "New", "Fixed"] as const

export type ChangelogFilter = (typeof changelogFilters)[number]

export const changelogLinks = {
	releases: "https://github.com/cortex-md/cortex-app/releases",
	feed: "/changelog.xml",
} as const

export const downloadPlatformLabels = {
	macos: "macOS",
	windows: "Windows",
	debian: "Ubuntu / Debian",
	linux: "Linux",
} as const
