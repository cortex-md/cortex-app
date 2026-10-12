import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const DEFAULT_RENDERER_URL = "http://localhost:1420"
const SERVER_WAIT_MS = 30_000
const SERVER_POLL_MS = 500

const profile = process.argv[2]
if (!profile) {
	console.error("Usage: bun run dev:profile <name>  (start `bun run dev` first)")
	process.exit(1)
}

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const mainEntry = join(appRoot, "out/main/index.js")
if (!existsSync(mainEntry)) {
	console.error(
		"out/main/index.js not found. Start `bun run dev` first so the main process is built.",
	)
	process.exit(1)
}

async function isServerReady(url: string): Promise<boolean> {
	try {
		return (await fetch(url)).ok
	} catch {
		return false
	}
}

async function waitForServer(url: string): Promise<boolean> {
	const deadline = Date.now() + SERVER_WAIT_MS
	let warned = false
	while (Date.now() < deadline) {
		if (await isServerReady(url)) return true
		if (!warned) console.info(`Waiting for the dev server at ${url} (run \`bun run dev\`)...`)
		warned = true
		await new Promise((resolve) => setTimeout(resolve, SERVER_POLL_MS))
	}
	return false
}

const rendererUrl = process.env.ELECTRON_RENDERER_URL ?? DEFAULT_RENDERER_URL
if (!(await waitForServer(rendererUrl))) {
	console.error(`The dev server at ${rendererUrl} is not running. Start \`bun run dev\` first.`)
	process.exit(1)
}

const electronBinary = createRequire(import.meta.url)("electron") as string
const child = spawn(electronBinary, [mainEntry, `--profile=${profile}`], {
	cwd: appRoot,
	stdio: "inherit",
	env: { ...process.env, ELECTRON_RENDERER_URL: rendererUrl },
})
child.on("exit", (code) => process.exit(code ?? 0))
