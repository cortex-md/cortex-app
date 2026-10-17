import { basename, resolve } from "node:path"
import { app, BrowserWindow, nativeTheme, type WebContents } from "electron"
import type { MainApi, MainEventName, MainEvents } from "./contract"
import { EVENT_CHANNEL_PREFIX } from "./contract"
import { getInvokeSender } from "./ipc/sender"
import { getActiveProfile } from "./profile"
import { readWindowBounds, trackWindowBounds } from "./services/windowState"
import { createMainWindow } from "./window"

const CASCADE_OFFSET = 24
const SHOW_FALLBACK_MS = 4000

interface MainWindowEntry {
	window: BrowserWindow
	vaultPath: string | null
	ready: boolean
	pending: ((contents: WebContents) => void)[]
	showFallback: NodeJS.Timeout | null
}

const mainWindows = new Map<number, MainWindowEntry>()
const claimedKeys = new Set<string>()
export type WindowsChangeReason = "focus" | "list"

const windowListeners = new Set<(reason: WindowsChangeReason) => void>()
const closedListeners = new Set<(contentsId: number) => void>()
let lastFocusedMainId: number | null = null
let urls: { renderer: string; preload: string } | null = null

function isAlive(window: BrowserWindow | null | undefined): window is BrowserWindow {
	return Boolean(window) && !window?.isDestroyed()
}

function normalizeVaultPath(path: string): string {
	return resolve(path)
}

function withProfile(title: string): string {
	const profile = getActiveProfile()
	return profile ? `${title} [${profile}]` : title
}

function keepTitle(window: BrowserWindow, title: string): void {
	window.setTitle(title)
	window.on("page-title-updated", (event) => event.preventDefault())
}

function notifyWindowsChanged(reason: WindowsChangeReason = "list"): void {
	for (const listener of windowListeners) listener(reason)
}

export function onWindowsChanged(listener: (reason: WindowsChangeReason) => void): () => void {
	windowListeners.add(listener)
	return () => windowListeners.delete(listener)
}

export function onMainWindowClosed(listener: (contentsId: number) => void): () => void {
	closedListeners.add(listener)
	return () => closedListeners.delete(listener)
}

function rendererUrl(params: Record<string, string>): string {
	if (!urls) throw new Error("Windows are not configured")
	const url = new URL(urls.renderer)
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
	return url.toString()
}

function cascadeBounds(): Electron.Rectangle | undefined {
	const anchor = getFocusedMainEntry()?.window ?? [...mainWindows.values()].at(-1)?.window
	if (!isAlive(anchor)) return undefined
	const bounds = anchor.getBounds()
	return { ...bounds, x: bounds.x + CASCADE_OFFSET, y: bounds.y + CASCADE_OFFSET }
}

function createMain(params: Record<string, string>, vaultPath: string | null): MainWindowEntry {
	if (!urls) throw new Error("Windows are not configured")
	const bounds = (vaultPath ? readWindowBounds(vaultPath) : undefined) ?? cascadeBounds()
	const window = createMainWindow(rendererUrl(params), urls.preload, bounds)
	const contentsId = window.webContents.id
	keepTitle(window, withProfile(vaultPath ? basename(vaultPath) : "Cortex"))
	const entry: MainWindowEntry = {
		window,
		vaultPath,
		ready: false,
		pending: [],
		showFallback: setTimeout(() => revealWindow(entry), SHOW_FALLBACK_MS),
	}
	mainWindows.set(contentsId, entry)
	lastFocusedMainId = contentsId
	trackWindowBounds(window, () => entry.vaultPath)

	window.on("focus", () => {
		lastFocusedMainId = contentsId
		notifyWindowsChanged("focus")
	})
	window.webContents.on("did-start-navigation", (details) => {
		if (details.isMainFrame && !details.isSameDocument) entry.ready = false
	})
	window.on("closed", () => {
		if (entry.showFallback) clearTimeout(entry.showFallback)
		mainWindows.delete(contentsId)
		for (const listener of closedListeners) listener(contentsId)
		if (lastFocusedMainId === contentsId) lastFocusedMainId = null
		notifyWindowsChanged()
	})
	notifyWindowsChanged()
	return entry
}

const firstRevealListeners = new Set<() => void>()
let firstRevealDone = false

export function onFirstWindowRevealed(listener: () => void): void {
	if (firstRevealDone) listener()
	else firstRevealListeners.add(listener)
}

function revealWindow(entry: MainWindowEntry): void {
	if (entry.showFallback) clearTimeout(entry.showFallback)
	entry.showFallback = null
	if (isAlive(entry.window) && !entry.window.isVisible()) entry.window.show()
	if (firstRevealDone) return
	firstRevealDone = true
	for (const listener of firstRevealListeners) listener()
	firstRevealListeners.clear()
}

function focusWindow(window: BrowserWindow): void {
	if (window.isMinimized()) window.restore()
	window.show()
	window.focus()
}

function getFocusedMainEntry(): MainWindowEntry | null {
	const focused = BrowserWindow.getFocusedWindow()
	if (focused) {
		const entry = mainWindows.get(focused.webContents.id)
		if (entry) return entry
	}
	if (lastFocusedMainId !== null) {
		const entry = mainWindows.get(lastFocusedMainId)
		if (entry) return entry
	}
	return [...mainWindows.values()].at(-1) ?? null
}

function findVaultOwner(vaultPath: string): MainWindowEntry | null {
	const normalized = normalizeVaultPath(vaultPath)
	for (const entry of mainWindows.values()) {
		if (entry.vaultPath && normalizeVaultPath(entry.vaultPath) === normalized) return entry
	}
	return null
}

export function configureWindows(rendererBaseUrl: string, preloadPath: string): void {
	urls = { renderer: rendererBaseUrl, preload: preloadPath }
}

export function listMainWindows(): {
	contentsId: number
	vaultPath: string | null
	focused: boolean
}[] {
	const focusedId = getFocusedMainEntry()?.window.webContents.id
	return [...mainWindows.entries()].map(([contentsId, entry]) => ({
		contentsId,
		vaultPath: entry.vaultPath,
		focused: contentsId === focusedId,
	}))
}

export function resolveMainWindowId(contentsId: number): number | null {
	return mainWindows.has(contentsId) ? contentsId : null
}

export function getMainWindowVault(contentsId: number): string | null {
	return mainWindows.get(contentsId)?.vaultPath ?? null
}

export function openStartupWindow(): BrowserWindow {
	return createMain({}, null).window
}

export function openNewWindow(): BrowserWindow {
	const entry = createMain({ blank: "1" }, null)
	return entry.window
}

export function openVaultWindow(vaultPath: string): BrowserWindow {
	const owner = findVaultOwner(vaultPath)
	if (owner) {
		focusWindow(owner.window)
		return owner.window
	}
	return createMain({ vault: vaultPath }, vaultPath).window
}

export function focusMainWindow(): void {
	const entry = getFocusedMainEntry()
	if (entry) focusWindow(entry.window)
	else openStartupWindow()
}

function withTargetWindow(run: (contents: WebContents) => void): void {
	const entry = getFocusedMainEntry() ?? mainWindows.get(openStartupWindow().webContents.id)
	if (!entry) return
	if (entry.ready) run(entry.window.webContents)
	else entry.pending.push(run)
}

type EventArgs<E extends MainEventName> = MainEvents[E] extends undefined ? [E] : [E, MainEvents[E]]

export function emitToTargetWindow<E extends MainEventName>(
	...[event, payload]: EventArgs<E>
): void {
	withTargetWindow((contents) => contents.send(`${EVENT_CHANNEL_PREFIX}${event}`, payload))
}

export function emitToVaultWindow<E extends MainEventName>(
	vaultPath: string,
	...[event, payload]: EventArgs<E>
): boolean {
	const owner = findVaultOwner(vaultPath)
	if (!owner || owner.window.webContents.isDestroyed()) return false
	const send = (contents: WebContents) => contents.send(`${EVENT_CHANNEL_PREFIX}${event}`, payload)
	if (owner.ready) send(owner.window.webContents)
	else owner.pending.push(send)
	return true
}

export function emitToWindow<E extends MainEventName>(
	contentsId: number,
	...[event, payload]: EventArgs<E>
): void {
	const entry = mainWindows.get(contentsId)
	if (entry && !entry.window.webContents.isDestroyed()) {
		entry.window.webContents.send(`${EVENT_CHANNEL_PREFIX}${event}`, payload)
	}
}

function setWindowVault(contents: WebContents, vaultPath: string | null): void {
	const entry = mainWindows.get(contents.id)
	if (!entry) return
	entry.vaultPath = vaultPath
	entry.window.setTitle(withProfile(vaultPath ? basename(vaultPath) : "Cortex"))
	if (process.platform === "darwin") entry.window.setRepresentedFilename(vaultPath ?? "")
	if (vaultPath) app.addRecentDocument(vaultPath)
	notifyWindowsChanged()
}

export const windowApi = {
	closeCurrent: async () => {
		const sender = getInvokeSender()
		if (sender) BrowserWindow.fromWebContents(sender)?.close()
	},
	focusMain: async () => {
		focusMainWindow()
	},
	restartApp: async () => {
		app.relaunch()
		app.exit(0)
	},
	setColorScheme: async (scheme) => {
		nativeTheme.themeSource = scheme
	},
	openVaultWindow: async (vaultPath) => {
		openVaultWindow(vaultPath)
	},
	openNewWindow: async () => {
		openNewWindow()
	},
	claimVault: async (vaultPath) => {
		const sender = getInvokeSender()
		const owner = findVaultOwner(vaultPath)
		if (owner && owner.window.webContents.id !== sender?.id) {
			focusWindow(owner.window)
			return "focused-owner"
		}
		if (sender) setWindowVault(sender, vaultPath)
		return "claimed"
	},
	releaseVault: async () => {
		const sender = getInvokeSender()
		if (sender) setWindowVault(sender, null)
	},
	claimOnce: async (key) => {
		if (claimedKeys.has(key)) return false
		claimedKeys.add(key)
		return true
	},
	markReady: async () => {
		const sender = getInvokeSender()
		const entry = sender ? mainWindows.get(sender.id) : undefined
		if (!entry) return
		entry.ready = true
		revealWindow(entry)
		const pending = entry.pending.splice(0)
		for (const run of pending) run(entry.window.webContents)
	},
} satisfies MainApi["window"]
