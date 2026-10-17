import { appendFile, readFile, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { ElectronApplication, Page } from "playwright-core"
import { launchDesktop, totalMemoryMb } from "./electron.ts"
import { ensureFixture, FIXTURE_NOTES, type Fixture, type FixtureScale, SCALES } from "./fixture.ts"
import {
	armKey,
	installProbe,
	measureClick,
	measureScrollFps,
	measureTyping,
	revealTreeItem,
	settleKey,
} from "./probe.ts"

type Unit = "ms" | "MB" | "fps"

interface Metric {
	id: string
	label: string
	unit: Unit
	samples: number[]
	budget?: number
	higherIsBetter?: boolean
}

interface Options {
	scale: FixtureScale
	launches: number
	jsonPath: string | null
	strict: boolean
}

const BUDGETS = {
	startup: 1_500,
	noteOpen: 80,
	typing: 16,
	search: 100,
	quickFinder: 30,
	overlayFirstOpen: 120,
	overlayOpen: 50,
	tabSwitch: 100,
	settingsOpen: 100,
	idleMemory: 800,
	databaseOpen: 300,
	databaseFilter: 100,
}

const MOD = process.platform === "darwin" ? "Meta" : "Control"
const COMMAND_INPUT = '[data-command-surface] [data-slot="command-input"]'

function parseArgs(argv: string[]): Options {
	const options: Options = { scale: "roadmap", launches: 3, jsonPath: null, strict: false }
	for (let index = 0; index < argv.length; index++) {
		const arg = argv[index]
		const value = argv[index + 1]
		if (arg === "--scale" && (value === "smoke" || value === "roadmap")) {
			options.scale = value
			index++
		} else if (arg === "--launches" && value) {
			options.launches = Math.max(1, Number(value))
			index++
		} else if (arg === "--json" && value) {
			options.jsonPath = value
			index++
		} else if (arg === "--strict") {
			options.strict = true
		} else {
			console.log(`Usage: bun run perf -- [--scale smoke|roadmap] [--launches 3] [--json out.json] [--strict]

Builds nothing: run \`bun run build\` first. The app runs with the isolated
"perf-<scale>" profile against a generated vault cached in the OS temp directory.`)
			process.exit(arg === "--help" || arg === "-h" ? 0 : 1)
		}
	}
	return options
}

function step(label: string): void {
	console.log(`• ${label}`)
}

function percentile(values: number[], fraction: number): number {
	if (values.length === 0) return Number.NaN
	const sorted = [...values].sort((left, right) => left - right)
	return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? Number.NaN
}

async function waitForIndex(fixture: Fixture): Promise<void> {
	const indexPath = join(fixture.path, ".cortex/cache/search-index.json")
	let lastSize = -1
	let stableSince = Date.now()
	const deadline = Date.now() + 300_000
	while (Date.now() < deadline) {
		const size = await stat(indexPath).then(
			(info) => info.size,
			() => -1,
		)
		if (size !== lastSize) {
			lastSize = size
			stableSince = Date.now()
		} else if (size > 0 && Date.now() - stableSince > 4_000) {
			return
		}
		await new Promise((resolve) => setTimeout(resolve, 500))
	}
	throw new Error("Timed out waiting for the search index to settle")
}

async function waitForWorkspace(fixture: Fixture, title: string): Promise<void> {
	const workspacePath = join(fixture.path, ".cortex/workspace.json")
	const deadline = Date.now() + 30_000
	while (Date.now() < deadline) {
		const content = await readFile(workspacePath, "utf8").catch(() => "")
		if (content.includes(title)) return
		await new Promise((resolve) => setTimeout(resolve, 250))
	}
	throw new Error("Timed out waiting for the workspace to persist")
}

async function openQuickFinder(page: Page): Promise<void> {
	await page.keyboard.press(`${MOD}+O`)
	const input = page.getByPlaceholder("Find a note, or type > for commands")
	await input.waitFor()
	await input.focus()
}

async function measureOverlayOpen(page: Page, key: string, runs = 6): Promise<number[]> {
	const samples: number[] = []
	for (let index = 0; index < runs; index++) {
		await armKey(page)
		await page.keyboard.press(`${MOD}+${key}`)
		samples.push(await settleKey(page, { kind: "focused", selector: COMMAND_INPUT }, 10_000))
		await page.keyboard.press("Escape")
		await page.locator(COMMAND_INPUT).waitFor({ state: "detached" })
		await page.waitForTimeout(250)
	}
	return samples
}

function pushOverlayMetrics(metrics: Metric[], id: string, label: string, samples: number[]): void {
	const [first = Number.NaN, ...warm] = samples
	metrics.push({
		id: `${id}-first-open`,
		label: `${label}, primeira abertura`,
		unit: "ms",
		samples: [first],
		budget: BUDGETS.overlayFirstOpen,
	})
	metrics.push({
		id: `${id}-open`,
		label: `${label}, aberturas seguintes`,
		unit: "ms",
		samples: warm,
		budget: BUDGETS.overlayOpen,
	})
}

async function openWithQuickFinder(
	page: Page,
	title: string,
	marker: string,
	newTab = false,
): Promise<void> {
	await openQuickFinder(page)
	await page.keyboard.type(title, { delay: 10 })
	await page.waitForTimeout(400)
	await page.keyboard.press(newTab ? `${MOD}+Enter` : "Enter")
	await page.locator(".cm-content", { hasText: marker }).first().waitFor({ state: "visible" })
}

async function measureStartup(fixture: Fixture, profile: string, launches: number): Promise<number[]> {
	const samples: number[] = []
	for (let index = 0; index < launches; index++) {
		const started = performance.now()
		const { app, window } = await launchDesktop({ vaultPath: fixture.path, profile })
		await window
			.locator('.cm-content[contenteditable="true"]', { hasText: "PERF-NOTE-A" })
			.first()
			.waitFor({ state: "visible", timeout: 60_000 })
		samples.push(performance.now() - started)
		await app.close()
	}
	return samples
}

async function measureSettings(page: Page): Promise<number[]> {
	const samples: number[] = []
	for (let index = 0; index < 3; index++) {
		await armKey(page)
		await page.keyboard.press(`${MOD}+Comma`)
		samples.push(await settleKey(page, { kind: "selector", selector: ".settings-content" }, 10_000))
		await page.keyboard.press("Escape")
		await page.locator(".settings-content").waitFor({ state: "detached" })
		await page.waitForTimeout(300)
	}
	return samples
}

async function measureSession(fixture: Fixture, profile: string): Promise<Metric[]> {
	const metrics: Metric[] = []
	const { app, window: page } = await launchDesktop({ vaultPath: fixture.path, profile })
	try {
		await installProbe(page)
		await page.locator(".cm-content", { hasText: "PERF-NOTE-A" }).first().waitFor()

		step("overlay open")
		pushOverlayMetrics(metrics, "quick-finder", "Quick Finder", await measureOverlayOpen(page, "O"))
		pushOverlayMetrics(metrics, "command-palette", "Command Palette", await measureOverlayOpen(page, "P"))
		await openWithQuickFinder(page, FIXTURE_NOTES.smallB, "PERF-NOTE-B", true)

		step("tab switch")
		const tabSwitch: number[] = []
		for (let index = 0; index < 8; index++) {
			const target = index % 2 === 0 ? 1 : 2
			await armKey(page)
			await page.keyboard.press(`${MOD}+${target}`)
			tabSwitch.push(
				await settleKey(page, {
					kind: "editor-has",
					text: target === 1 ? "PERF-NOTE-A" : "PERF-NOTE-B",
				}),
			)
		}
		metrics.push({
			id: "tab-switch",
			label: "Trocar de aba",
			unit: "ms",
			samples: tabSwitch,
			budget: BUDGETS.tabSwitch,
		})

		step("note open")
		const bigNote = await revealTreeItem(page, `${FIXTURE_NOTES.bigNote}.md`)
		const smallNote = await revealTreeItem(page, `${FIXTURE_NOTES.smallA}.md`)
		const noteOpen: number[] = []
		for (let index = 0; index < 4; index++) {
			noteOpen.push(
				await measureClick(page, bigNote, { kind: "editor-has", text: FIXTURE_NOTES.bigNoteMarker }),
			)
			await measureClick(page, smallNote, { kind: "editor-has", text: "PERF-NOTE-A" })
		}
		metrics.push({
			id: "note-open",
			label: `Abrir nota de ${fixture.config.bigNoteLines.toLocaleString("en-US")} linhas`,
			unit: "ms",
			samples: noteOpen,
			budget: BUDGETS.noteOpen,
		})

		await measureClick(page, bigNote, { kind: "editor-has", text: FIXTURE_NOTES.bigNoteMarker })
		step("editor scroll fps")
		const editorScroll = await measureScrollFps(page, ".cm-content")
		metrics.push({
			id: "editor-scroll-fps",
			label: "FPS rolando a nota grande",
			unit: "fps",
			samples: [editorScroll.fps],
			higherIsBetter: true,
		})

		step("typing")
		await page.locator(".cm-content", { hasText: FIXTURE_NOTES.bigNoteMarker }).first().click()
		await page.keyboard.press(`${MOD}+End`)
		metrics.push({
			id: "typing",
			label: "Latência de digitação (nota grande)",
			unit: "ms",
			samples: await measureTyping(page, " the quick brown fox jumps over the lazy dog".repeat(2)),
			budget: BUDGETS.typing,
		})

		step("quick finder")
		const quickFinder: number[] = []
		await openQuickFinder(page)
		for (const character of "Note 4217") {
			await armKey(page, ".quick-finder-list")
			await page.keyboard.press(character === " " ? "Space" : character)
			quickFinder.push(
				await settleKey(page, { kind: "selector", selector: ".quick-finder-list" }, 5_000).catch(
					() => Number.NaN,
				),
			)
		}
		await page.keyboard.press("Escape")
		metrics.push({
			id: "quick-finder",
			label: "Quick Finder, por tecla",
			unit: "ms",
			samples: quickFinder.filter(Number.isFinite),
			budget: BUDGETS.quickFinder,
		})

		step("search")
		const search: number[] = []
		await page.keyboard.press(`${MOD}+Shift+F`)
		const searchInput = page.getByPlaceholder("Search in vault...")
		await searchInput.waitFor()
		for (let index = 0; index < 6; index++) {
			const term = index % 2 === 0 ? FIXTURE_NOTES.rareTerm : FIXTURE_NOTES.commonTerm
			await searchInput.fill(term)
			await page.waitForTimeout(300)
			await armKey(page)
			await searchInput.press("Enter")
			search.push(
				await settleKey(page, { kind: "selector", selector: ".sidebar-search-file" }, 10_000),
			)
		}
		metrics.push({
			id: "search",
			label: `Busca no vault (${fixture.config.notes.toLocaleString("en-US")} notas)`,
			unit: "ms",
			samples: search,
			budget: BUDGETS.search,
		})

		step("settings")
		metrics.push({
			id: "settings-open",
			label: "Abrir Settings",
			unit: "ms",
			samples: await measureSettings(page),
			budget: BUDGETS.settingsOpen,
		})

		step("database open")
		await page.locator('.sidebar-rail [aria-label="Files"]').click()
		const database = await revealTreeItem(page, FIXTURE_NOTES.database)
		const databaseOpen = await measureClick(page, database, {
			kind: "selector",
			selector: ".db-row",
		})
		metrics.push({
			id: "database-open",
			label: `Abrir database (${fixture.config.databaseRows.toLocaleString("en-US")} linhas)`,
			unit: "ms",
			samples: [databaseOpen],
			budget: BUDGETS.databaseOpen,
		})

		step("database filter")
		const databaseSearch = page.locator(".db-search input")
		const databaseFilter: number[] = []
		for (const term of ["123", "377", "250", "401"]) {
			await databaseSearch.fill("")
			await page.waitForTimeout(250)
			await databaseSearch.focus()
			await page.keyboard.type(term.slice(0, -1), { delay: 5 })
			await page.waitForTimeout(250)
			await armKey(page)
			await page.keyboard.press(term.slice(-1))
			databaseFilter.push(await settleKey(page, { kind: "db-filtered", text: term }, 10_000))
		}
		metrics.push({
			id: "database-filter",
			label: "Filtrar database",
			unit: "ms",
			samples: databaseFilter,
			budget: BUDGETS.databaseFilter,
		})
		await databaseSearch.fill("")
		await page.waitForTimeout(300)
		const databaseScroll = await measureScrollFps(page, ".db-row")
		metrics.push({
			id: "database-scroll-fps",
			label: "FPS rolando a database",
			unit: "fps",
			samples: [databaseScroll.fps],
			higherIsBetter: true,
		})

		step("idle memory")
		await page.keyboard.press("Escape")
		await page.waitForTimeout(20_000)
		const memorySamples: number[] = []
		for (let index = 0; index < 5; index++) {
			memorySamples.push((await totalMemoryMb(app)).totalMb)
			await page.waitForTimeout(2_000)
		}
		metrics.push({
			id: "idle-memory",
			label: "Memória ociosa (todos os processos, mediana após 20 s)",
			unit: "MB",
			samples: [percentile(memorySamples, 0.5)],
			budget: BUDGETS.idleMemory,
		})
	} finally {
		await app.close()
	}
	return metrics
}

function summarize(metric: Metric) {
	const value =
		metric.unit === "ms" ? percentile(metric.samples, 0.95) : (metric.samples[0] ?? Number.NaN)
	const passed =
		metric.budget === undefined || Number.isNaN(value)
			? null
			: metric.higherIsBetter
				? value >= metric.budget
				: value <= metric.budget
	return {
		...metric,
		p50: percentile(metric.samples, 0.5),
		value,
		passed,
	}
}

function format(value: number, unit: Unit): string {
	if (Number.isNaN(value)) return "n/a"
	return unit === "fps" ? `${value.toFixed(1)} fps` : `${Math.round(value)} ${unit}`
}

function table(results: ReturnType<typeof summarize>[]): string {
	const rows = results.map((result) => [
		result.label,
		String(result.samples.length),
		format(result.p50, result.unit),
		format(result.value, result.unit),
		result.budget === undefined ? "—" : format(result.budget, result.unit),
		result.passed === null ? "—" : result.passed ? "ok" : "ACIMA",
	])
	const header = ["Métrica", "Amostras", "p50", "p95 / valor", "Meta", "Status"]
	return [header, header.map(() => "---"), ...rows].map((row) => `| ${row.join(" | ")} |`).join("\n")
}

const options = parseArgs(process.argv.slice(2))
const fixture = await ensureFixture(options.scale)
const profile = `perf-${options.scale}`
console.log(`Vault: ${fixture.path}`)

step("warm-up launch and index")
const warmup = await launchDesktop({ vaultPath: fixture.path, profile })
await waitForIndex(fixture)
await openWithQuickFinder(warmup.window, FIXTURE_NOTES.smallA, "PERF-NOTE-A")
await waitForWorkspace(fixture, FIXTURE_NOTES.smallA)
await warmup.app.close()

step("startup")
const metrics: Metric[] = [
	{
		id: "startup",
		label: `Abrir o app até digitar (${SCALES[options.scale].notes.toLocaleString("en-US")} notas)`,
		unit: "ms",
		samples: await measureStartup(fixture, profile, options.launches),
		budget: BUDGETS.startup,
	},
	...(await measureSession(fixture, profile)),
]
const results = metrics.map(summarize)
const report = table(results)
console.log(`\n${report}\n`)

if (options.jsonPath) {
	await writeFile(
		options.jsonPath,
		`${JSON.stringify({ scale: options.scale, platform: process.platform, date: new Date().toISOString(), results }, null, 2)}\n`,
	)
}
if (process.env.GITHUB_STEP_SUMMARY) {
	await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Desktop performance (${options.scale})\n\n${report}\n`)
}
if (options.strict && results.some((result) => result.passed === false)) process.exit(1)
