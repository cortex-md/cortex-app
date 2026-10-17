export type BeforeInstallHook = () => Promise<void>

/**
 * `flush` hooks run before the installer starts and cancel the install when they fail (unsaved
 * notes). `teardown` hooks run after the installer was handed off, right before the app quits, so
 * a failed hand-off never leaves the app running without watchers or sync.
 */
export type BeforeInstallPhase = "flush" | "teardown"

interface RegisteredHook {
	name: string
	phase: BeforeInstallPhase
	run: BeforeInstallHook
}

export interface HookFailure {
	name: string
	message: string
}

const hooks: RegisteredHook[] = []

export function registerBeforeInstallHook(
	name: string,
	phase: BeforeInstallPhase,
	run: BeforeInstallHook,
): () => void {
	const hook = { name, phase, run }
	hooks.push(hook)
	return () => {
		const index = hooks.indexOf(hook)
		if (index >= 0) hooks.splice(index, 1)
	}
}

function withTimeout(promise: Promise<void>, timeoutMs: number, name: string): Promise<void> {
	let timer: NodeJS.Timeout | undefined
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(
			() => reject(new Error(`${name} timed out after ${timeoutMs} ms`)),
			timeoutMs,
		)
	})
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export async function runBeforeInstallHooks(
	phase: BeforeInstallPhase,
	timeoutMs: number,
): Promise<HookFailure[]> {
	const failures: HookFailure[] = []
	for (const hook of hooks.filter((entry) => entry.phase === phase)) {
		const startedAt = Date.now()
		try {
			await withTimeout(hook.run(), timeoutMs, hook.name)
			console.info(`[updates] ${phase} ${hook.name} done in ${Date.now() - startedAt} ms`)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			console.warn(`[updates] ${phase} ${hook.name} failed: ${message}`)
			failures.push({ name: hook.name, message })
		}
	}
	return failures
}
