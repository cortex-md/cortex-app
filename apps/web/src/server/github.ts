const GITHUB_API_VERSION = "2022-11-28"

export const githubRepo = "cortex-md/cortex-app"

export function githubApiHeaders(userAgent: string, token = process.env.GITHUB_TOKEN?.trim()) {
	return {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": GITHUB_API_VERSION,
		"User-Agent": userAgent,
		...(token ? { Authorization: `Bearer ${token}` } : {}),
	}
}
