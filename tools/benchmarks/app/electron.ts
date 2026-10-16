import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { join, resolve } from "node:path"
import { _electron, type ElectronApplication, type Page } from "playwright-core"

export const REPO_ROOT = resolve(import.meta.dirname, "../../..")
const DESKTOP_ROOT = join(REPO_ROOT, "apps/desktop")
const MAIN_ENTRY = join(DESKTOP_ROOT, "out/main/index.js")

export interface LaunchOptions {
	vaultPath: string
	profile: string
}

export interface LaunchedApp {
	app: ElectronApplication
	window: Page
}

function electronExecutable(): string {
	const require = createRequire(join(DESKTOP_ROOT, "package.json"))
	return require("electron") as string
}

export function assertDesktopBuild(): void {
	if (existsSync(MAIN_ENTRY)) return
	throw new Error("apps/desktop/out is missing. Run `bun run build` first.")
}

export async function launchDesktop({ vaultPath, profile }: LaunchOptions): Promise<LaunchedApp> {
	assertDesktopBuild()
	const app = await _electron.launch({
		executablePath: electronExecutable(),
		args: [
			MAIN_ENTRY,
			`--profile=${profile}`,
			`--open-vault=${vaultPath}`,
			...(process.platform === "linux" ? ["--no-sandbox"] : []),
		],
		cwd: DESKTOP_ROOT,
	})
	const window = await waitForVaultWindow(app)
	return { app, window }
}

async function waitForVaultWindow(app: ElectronApplication): Promise<Page> {
	const deadline = Date.now() + 60_000
	while (Date.now() < deadline) {
		for (const page of app.windows()) {
			if (await page.locator(".file-tree-item").first().isVisible().catch(() => false)) return page
		}
		await new Promise((resolve) => setTimeout(resolve, 100))
	}
	throw new Error("Timed out waiting for the vault window")
}

export async function totalMemoryMb(app: ElectronApplication): Promise<{
	totalMb: number
	byType: Record<string, number>
}> {
	return app.evaluate(({ app: electronApp }) => {
		const byType: Record<string, number> = {}
		let total = 0
		for (const metric of electronApp.getAppMetrics()) {
			const mb = metric.memory.workingSetSize / 1024
			total += mb
			byType[metric.type] = (byType[metric.type] ?? 0) + mb
		}
		return { totalMb: total, byType }
	})
}
