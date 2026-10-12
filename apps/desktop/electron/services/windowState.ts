import { readFileSync, renameSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { type BrowserWindow, type Rectangle, screen } from "electron"
import { windowStatePath } from "../paths"

const SAVE_DELAY_MS = 400
const MAX_ENTRIES = 50

type WindowStateFile = Record<string, Rectangle & { updatedAt: number }>

let cache: WindowStateFile | null = null
let saveTimer: NodeJS.Timeout | null = null

function readState(): WindowStateFile {
	if (cache) return cache
	try {
		cache = JSON.parse(readFileSync(windowStatePath(), "utf8")) as WindowStateFile
	} catch {
		cache = {}
	}
	return cache
}

function flush(): void {
	saveTimer = null
	const state = readState()
	const entries = Object.entries(state)
		.sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
		.slice(0, MAX_ENTRIES)
	const path = windowStatePath()
	try {
		writeFileSync(`${path}.tmp`, JSON.stringify(Object.fromEntries(entries)))
		renameSync(`${path}.tmp`, path)
	} catch (error) {
		console.warn("[window-state] save failed:", error)
	}
}

function isVisibleOnSomeDisplay(bounds: Rectangle): boolean {
	return screen.getAllDisplays().some(({ workArea }) => {
		const overlapX =
			Math.min(bounds.x + bounds.width, workArea.x + workArea.width) -
			Math.max(bounds.x, workArea.x)
		const overlapY =
			Math.min(bounds.y + bounds.height, workArea.y + workArea.height) -
			Math.max(bounds.y, workArea.y)
		return overlapX > 80 && overlapY > 80
	})
}

export function readWindowBounds(vaultPath: string): Rectangle | undefined {
	const saved = readState()[resolve(vaultPath)]
	if (!saved) return undefined
	const { updatedAt: _updatedAt, ...bounds } = saved
	return isVisibleOnSomeDisplay(bounds) ? bounds : undefined
}

export function trackWindowBounds(window: BrowserWindow, getVaultPath: () => string | null): void {
	const save = () => {
		const vaultPath = getVaultPath()
		if (!vaultPath || window.isDestroyed() || window.isFullScreen() || window.isMinimized()) return
		readState()[resolve(vaultPath)] = { ...window.getNormalBounds(), updatedAt: Date.now() }
		if (saveTimer) clearTimeout(saveTimer)
		saveTimer = setTimeout(flush, SAVE_DELAY_MS)
	}
	window.on("resize", save)
	window.on("move", save)
	window.on("close", save)
}
