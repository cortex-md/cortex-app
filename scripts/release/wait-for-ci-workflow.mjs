const token = process.env.GITHUB_TOKEN
const repository = process.env.GITHUB_REPOSITORY
const runId = process.env.GITHUB_RUN_ID
const headSha = process.env.GITHUB_SHA
const eventName = process.env.GITHUB_EVENT_NAME
const ref = process.env.GITHUB_REF
const releaseTag = process.env.RELEASE_TAG
const workflowId = process.env.CI_WORKFLOW_ID ?? "ci.yml"
const pollMs = Number(process.env.CI_POLL_MS ?? 30000)
const attempts = Number(process.env.CI_POLL_ATTEMPTS ?? 120)

if (!token || !repository || !runId || !headSha || !releaseTag) {
	console.error("Missing required GitHub Actions environment for CI wait.")
	process.exit(1)
}

const [owner, repo] = repository.split("/")
const apiBaseUrl = "https://api.github.com"

async function githubFetch(path) {
	const response = await fetch(`${apiBaseUrl}${path}`, {
		headers: {
			accept: "application/vnd.github+json",
			authorization: `Bearer ${token}`,
			"x-github-api-version": "2022-11-28",
		},
	})
	if (!response.ok) {
		throw new Error(`GitHub API ${response.status} for ${path}: ${await response.text()}`)
	}
	return await response.json()
}

async function listWorkflowRuns() {
	const runs = []
	let page = 1
	while (page <= 10) {
		const params = new URLSearchParams({
			head_sha: headSha,
			event: "push",
			per_page: "100",
			page: String(page),
		})
		const data = await githubFetch(
			`/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?${params}`,
		)
		runs.push(...data.workflow_runs)
		if (data.workflow_runs.length < 100) break
		page += 1
	}
	return runs
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

const currentRun = await githubFetch(`/repos/${owner}/${repo}/actions/runs/${runId}`)
const currentRunStartedAt = new Date(currentRun.created_at).getTime()
const shouldUseRecentCiRun = eventName === "push" && ref?.startsWith("refs/tags/")
const earliestRunCreatedAt = shouldUseRecentCiRun ? currentRunStartedAt - 5 * 60 * 1000 : 0

for (let attempt = 1; attempt <= attempts; attempt += 1) {
	const runs = await listWorkflowRuns()
	const candidates = runs
		.filter((run) => String(run.id) !== String(runId))
		.filter((run) => new Date(run.created_at).getTime() >= earliestRunCreatedAt)
		.sort((first, second) => new Date(second.created_at) - new Date(first.created_at))
	const ciRun = candidates.find((run) => run.head_branch === releaseTag) ?? candidates[0]

	if (ciRun) {
		console.log(`CI run: ${ciRun.html_url}`)
		console.log(`CI status: ${ciRun.status}/${ciRun.conclusion ?? "pending"}`)

		if (ciRun.status === "completed") {
			if (ciRun.conclusion === "success") process.exit(0)
			throw new Error(`CI finished with conclusion: ${ciRun.conclusion}`)
		}
	} else {
		console.log(`No CI run found for ${headSha} yet.`)
	}

	if (attempt < attempts) await sleep(pollMs)
}

throw new Error("Timed out waiting for CI to pass.")
