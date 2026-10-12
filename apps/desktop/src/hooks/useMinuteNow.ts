import { toIsoDate } from "@cortex/tasks"
import { useSyncExternalStore } from "react"

const MINUTE_MS = 60_000

const listeners = new Set<() => void>()
let now = Date.now()
let today = toIsoDate(new Date(now))
let timer: ReturnType<typeof setInterval> | null = null

function tick() {
	now = Date.now()
	today = toIsoDate(new Date(now))
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
	listeners.add(listener)
	if (timer === null) {
		tick()
		timer = setInterval(tick, MINUTE_MS)
	}
	return () => {
		listeners.delete(listener)
		if (listeners.size === 0 && timer !== null) {
			clearInterval(timer)
			timer = null
		}
	}
}

function getSnapshot() {
	return now
}

function getTodaySnapshot() {
	return today
}

export function useMinuteNow(): number {
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useLocalToday(): string {
	return useSyncExternalStore(subscribe, getTodaySnapshot, getTodaySnapshot)
}
