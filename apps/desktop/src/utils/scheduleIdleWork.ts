export function scheduleIdleWork(work: () => void): () => void {
	if (typeof window.requestIdleCallback === "function") {
		const idleId = window.requestIdleCallback(work, { timeout: 1500 })
		return () => window.cancelIdleCallback(idleId)
	}
	const timeoutId = window.setTimeout(work, 250)
	return () => window.clearTimeout(timeoutId)
}
