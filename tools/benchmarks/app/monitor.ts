import type { Page } from "playwright-core"
import { launchDesktop } from "./electron.ts"
import { ensureFixture } from "./fixture.ts"

interface WindowSample {
	fps: number
	worstFrameMs: number
	longTasks: number
	heapMb: number
}

type MonitorWindow = Window & {
	__perfMonitor?: { read(): WindowSample }
}

function readArgs(argv: string[]): { vault: string | null; profile: string; intervalMs: number } {
	const options = { vault: null as string | null, profile: "perf-monitor", intervalMs: 1_000 }
	for (let index = 0; index < argv.length; index++) {
		const value = argv[index + 1]
		if (argv[index] === "--vault" && value) options.vault = value
		else if (argv[index] === "--profile" && value) options.profile = value
		else if (argv[index] === "--interval" && value) options.intervalMs = Math.max(250, Number(value))
		else continue
		index++
	}
	return options
}

async function attach(page: Page): Promise<void> {
	await page.evaluate(() => {
		const scope = window as MonitorWindow
		if (scope.__perfMonitor) return
		let frames = 0
		let worstFrame = 0
		let longTasks = 0
		let windowStart = performance.now()
		let last = windowStart
		const tick = (now: number) => {
			frames++
			worstFrame = Math.max(worstFrame, now - last)
			last = now
			requestAnimationFrame(tick)
		}
		requestAnimationFrame(tick)
		new PerformanceObserver((list) => {
			longTasks += list.getEntries().length
		}).observe({ type: "longtask", buffered: false })
		scope.__perfMonitor = {
			read() {
				const now = performance.now()
				const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } })
					.memory
				const sample = {
					fps: (frames * 1000) / Math.max(1, now - windowStart),
					worstFrameMs: worstFrame,
					longTasks,
					heapMb: (memory?.usedJSHeapSize ?? 0) / 1_048_576,
				}
				frames = 0
				worstFrame = 0
				longTasks = 0
				windowStart = now
				return sample
			},
		}
	})
}

const options = readArgs(process.argv.slice(2))
const vaultPath = options.vault ?? (await ensureFixture("smoke")).path
const { app, window: mainPage } = await launchDesktop({ vaultPath, profile: options.profile })
const pages = new Set<Page>([mainPage])
await attach(mainPage)
app.on("window", (page) => {
	pages.add(page)
	void page
		.waitForLoadState()
		.then(() => attach(page))
		.catch(() => {})
})
app.on("close", () => process.exit(0))
process.on("SIGINT", () => {
	void app.close().finally(() => process.exit(0))
})

console.log(`Monitoring ${vaultPath} (Ctrl+C to stop). Use the app normally.`)
console.log("window  fps   worst-frame  long-tasks  js-heap   app-ram   cpu")
setInterval(async () => {
	const metrics = await app
		.evaluate(({ app: electronApp }) =>
			electronApp.getAppMetrics().map((metric) => ({
				type: metric.type,
				ramMb: metric.memory.workingSetSize / 1024,
				cpu: metric.cpu.percentCPUUsage,
			})),
		)
		.catch(() => [])
	const ramMb = metrics.reduce((sum, metric) => sum + metric.ramMb, 0)
	const cpu = metrics.reduce((sum, metric) => sum + metric.cpu, 0)
	let index = 0
	for (const page of pages) {
		if (page.isClosed()) {
			pages.delete(page)
			continue
		}
		const sample = await page
			.evaluate(() => (window as MonitorWindow).__perfMonitor?.read())
			.catch(() => undefined)
		if (!sample) continue
		const flag = sample.worstFrameMs > 50 || sample.longTasks > 0 ? "  !" : ""
		console.log(
			[
				`#${index++}`.padEnd(7),
				sample.fps.toFixed(0).padStart(4),
				`${sample.worstFrameMs.toFixed(0)} ms`.padStart(12),
				String(sample.longTasks).padStart(11),
				`${sample.heapMb.toFixed(0)} MB`.padStart(9),
				`${ramMb.toFixed(0)} MB`.padStart(9),
				`${cpu.toFixed(0)}%`.padStart(6),
			].join("  ") + flag,
		)
	}
}, options.intervalMs)
