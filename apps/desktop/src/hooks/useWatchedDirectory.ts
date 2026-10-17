import { getPlatform, type WatchEvent } from "@cortex/platform"
import { useEffect, useEffectEvent } from "react"

const RELOAD_DELAY_MS = 300

export interface WatchedDirectoryHandlers {
	load: (directory: string, signal: AbortSignal) => Promise<void>
	reload: (directory: string, signal: AbortSignal, events: WatchEvent[]) => Promise<void>
	unload: () => void
	shouldReload?: (directory: string, event: WatchEvent) => boolean
	onError: (operation: "load" | "reload", error: unknown) => void
}

export function useWatchedDirectory(
	directory: string | null,
	handlers: WatchedDirectoryHandlers,
): void {
	const load = useEffectEvent(handlers.load)
	const reload = useEffectEvent(handlers.reload)
	const unload = useEffectEvent(handlers.unload)
	const shouldReload = useEffectEvent(
		(watchedDirectory: string, event: WatchEvent) =>
			handlers.shouldReload?.(watchedDirectory, event) ?? true,
	)
	const reportError = useEffectEvent(handlers.onError)

	useEffect(() => {
		if (!directory) return
		const controller = new AbortController()
		let stopWatching: (() => void) | null = null
		let reloadTimer: ReturnType<typeof setTimeout> | null = null
		let pendingEvents: WatchEvent[] = []

		const scheduleReload = (event: WatchEvent) => {
			if (!shouldReload(directory, event)) return
			pendingEvents.push(event)
			if (reloadTimer !== null) clearTimeout(reloadTimer)
			reloadTimer = setTimeout(() => {
				const events = pendingEvents
				pendingEvents = []
				reload(directory, controller.signal, events).catch((error) => reportError("reload", error))
			}, RELOAD_DELAY_MS)
		}

		const start = async () => {
			const platform = getPlatform()
			await platform.fs.createDir(directory)
			await load(directory, controller.signal)
			if (controller.signal.aborted) return
			const stop = await platform.fs.startWatching(directory, scheduleReload, {
				includeHidden: true,
				followSymlinks: true,
			})
			if (controller.signal.aborted) stop()
			else stopWatching = stop
		}
		start().catch((error) => {
			if (!controller.signal.aborted) reportError("load", error)
		})

		return () => {
			controller.abort()
			if (reloadTimer !== null) clearTimeout(reloadTimer)
			stopWatching?.()
			unload()
		}
	}, [directory])
}
