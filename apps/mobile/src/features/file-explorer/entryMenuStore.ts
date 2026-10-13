import { useSyncExternalStore } from "react"

import type { MenuGroup } from "@/components/ui/menuTypes"

export interface EntryMenuPoint {
	x: number
	y: number
}

export interface EntryMenuState extends EntryMenuPoint {
	groups: MenuGroup[]
	header?: string
	id: number
}

const listeners = new Set<() => void>()
let current: EntryMenuState | null = null
let lastPoint: EntryMenuPoint = { x: 24, y: 160 }
let nextId = 0

function notify(): void {
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getMenu(): EntryMenuState | null {
	return current
}

export function showEntryMenu(
	menu: { groups: MenuGroup[]; header?: string },
	point: EntryMenuPoint = lastPoint,
): void {
	lastPoint = point
	current = { ...menu, ...point, id: ++nextId }
	notify()
}

export function closeEntryMenu(): void {
	if (!current) return
	current = null
	notify()
}

export function useEntryMenu(): EntryMenuState | null {
	return useSyncExternalStore(subscribe, getMenu, getMenu)
}
