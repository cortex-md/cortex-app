import type { Page } from "playwright-core"

export type ProbeCondition =
	| { kind: "editor-has"; text: string }
	| { kind: "selector"; selector: string }
	| { kind: "db-filtered"; text: string }

interface PerfProbe {
	start: number | null
	mutations: number
	observer: MutationObserver | null
	onKey: ((event: KeyboardEvent) => void) | null
	until(predicate: () => boolean, timeoutMs?: number): Promise<number>
	matches(condition: ProbeCondition): boolean
}

type ProbeWindow = Window & { __perf?: PerfProbe }

export async function installProbe(page: Page): Promise<void> {
	await page.evaluate(() => {
		const scope = window as ProbeWindow
		if (scope.__perf) return
		const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))
		const visible = (element: Element) => (element as HTMLElement).offsetParent !== null
		scope.__perf = {
			start: null,
			mutations: 0,
			observer: null,
			onKey: null,
			async until(predicate, timeoutMs = 30_000) {
				const deadline = performance.now() + timeoutMs
				while (!predicate()) {
					if (performance.now() > deadline) throw new Error("perf probe timeout")
					await nextFrame()
				}
				await nextFrame()
				return performance.now()
			},
			matches(condition) {
				if (condition.kind === "editor-has") {
					return [...document.querySelectorAll(".cm-content")].some(
						(element) => visible(element) && element.textContent?.includes(condition.text),
					)
				}
				if (condition.kind === "selector") {
					return [...document.querySelectorAll(condition.selector)].some(visible)
				}
				const rows = [...document.querySelectorAll(".db-row")].filter(visible)
				return rows.length > 0 && rows.every((row) => row.textContent?.includes(condition.text))
			},
		}
	})
}

export async function armKey(page: Page, scopeSelector?: string): Promise<void> {
	await page.evaluate((scopeSelector) => {
		const probe = (window as ProbeWindow).__perf
		if (!probe) throw new Error("perf probe missing")
		probe.start = null
		probe.mutations = 0
		probe.observer?.disconnect()
		probe.observer = new MutationObserver((records) => {
			if (probe.start !== null) probe.mutations += records.length
		})
		const scope = (scopeSelector && document.querySelector(scopeSelector)) || document.body
		probe.observer.observe(scope, { childList: true, subtree: true, characterData: true })
		if (probe.onKey) window.removeEventListener("keydown", probe.onKey, true)
		probe.onKey = (event) => {
			if (probe.start === null) probe.start = event.timeStamp
		}
		window.addEventListener("keydown", probe.onKey, true)
	}, scopeSelector)
}

export async function settleKey(
	page: Page,
	condition: ProbeCondition,
	timeoutMs = 30_000,
): Promise<number> {
	return page.evaluate(
		async ({ condition, timeoutMs }) => {
			const probe = (window as ProbeWindow).__perf
			if (!probe) throw new Error("perf probe missing")
			try {
				const end = await probe.until(
					() => probe.start !== null && probe.mutations > 0 && probe.matches(condition),
					timeoutMs,
				)
				return end - (probe.start ?? end)
			} finally {
				probe.observer?.disconnect()
				probe.observer = null
				if (probe.onKey) window.removeEventListener("keydown", probe.onKey, true)
				probe.onKey = null
			}
		},
		{ condition, timeoutMs },
	)
}

export async function measureClick(
	page: Page,
	selector: string,
	condition: ProbeCondition,
): Promise<number> {
	return page.evaluate(
		async ({ selector, condition }) => {
			const probe = (window as ProbeWindow).__perf
			const target = document.querySelector<HTMLElement>(selector)
			if (!probe || !target) throw new Error(`perf click target missing: ${selector}`)
			const start = performance.now()
			target.click()
			return (await probe.until(() => probe.matches(condition))) - start
		},
		{ selector, condition },
	)
}

export async function revealTreeItem(page: Page, pathSuffix: string): Promise<string> {
	const selector = `[role="treeitem"][data-file-tree-path$="/${pathSuffix}"]`
	await page.evaluate(async (selector) => {
		const first = document.querySelector('[role="treeitem"]')
		let scroller = first?.parentElement ?? null
		while (scroller && scroller.scrollHeight <= scroller.clientHeight) scroller = scroller.parentElement
		for (let attempt = 0; attempt < 400 && !document.querySelector(selector); attempt++) {
			if (!scroller) break
			scroller.scrollTop += scroller.clientHeight * 0.8
			await new Promise((resolve) => requestAnimationFrame(resolve))
		}
		document.querySelector(selector)?.scrollIntoView({ block: "center" })
	}, selector)
	await page.locator(selector).waitFor({ state: "visible" })
	return selector
}

export interface FrameStats {
	fps: number
	p95FrameMs: number
	longFrames: number
	frames: number
}

export async function measureScrollFps(
	page: Page,
	anchorSelector: string,
	durationMs = 3_000,
): Promise<FrameStats> {
	return page.evaluate(
		async ({ anchorSelector, durationMs }) => {
			const anchor = [...document.querySelectorAll<HTMLElement>(anchorSelector)].find(
				(element) => element.offsetParent !== null,
			)
			let scroller: HTMLElement | null = anchor ?? null
			while (scroller && scroller.scrollHeight <= scroller.clientHeight + 4) {
				scroller = scroller.parentElement
			}
			if (!scroller) throw new Error(`no scrollable container for ${anchorSelector}`)
			const target = scroller
			const deltas: number[] = []
			let direction = 1
			let last = await new Promise<number>((resolve) => requestAnimationFrame(resolve))
			const end = last + durationMs
			while (last < end) {
				const now = await new Promise<number>((resolve) => {
					target.scrollTop += direction * 60
					if (target.scrollTop + target.clientHeight >= target.scrollHeight - 2) direction = -1
					if (target.scrollTop <= 0) direction = 1
					requestAnimationFrame(resolve)
				})
				deltas.push(now - last)
				last = now
			}
			const sorted = [...deltas].sort((left, right) => left - right)
			const total = deltas.reduce((sum, value) => sum + value, 0)
			return {
				fps: (deltas.length * 1000) / total,
				p95FrameMs: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0,
				longFrames: deltas.filter((value) => value > 33.4).length,
				frames: deltas.length,
			}
		},
		{ anchorSelector, durationMs },
	)
}

export async function measureTyping(page: Page, text: string): Promise<number[]> {
	await page.evaluate(() => {
		const scope = window as Window & { __typing?: number[]; __typingHandler?: EventListener }
		scope.__typing = []
		const channel = new MessageChannel()
		const pending: number[] = []
		channel.port1.onmessage = () => {
			const start = pending.shift()
			if (start !== undefined) scope.__typing?.push(performance.now() - start)
		}
		scope.__typingHandler = (event) => {
			pending.push(event.timeStamp)
			channel.port2.postMessage(null)
		}
		window.addEventListener("keydown", scope.__typingHandler, true)
	})
	await page.keyboard.type(text, { delay: 25 })
	return page.evaluate(async () => {
		await new Promise((resolve) => setTimeout(resolve, 50))
		const scope = window as Window & { __typing?: number[]; __typingHandler?: EventListener }
		if (scope.__typingHandler) window.removeEventListener("keydown", scope.__typingHandler, true)
		return scope.__typing ?? []
	})
}
