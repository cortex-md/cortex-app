import { basename, resolve } from "node:path"
import type { WindowMessage } from "@cortex/platform"
import { app, BrowserWindow, nativeTheme, type WebContents } from "electron"
import type { MainApi, MainEventName, MainEvents } from "./contract"
import { EVENT_CHANNEL_PREFIX } from "./contract"
import { getInvokeSender } from "./ipc/sender"
import { getActiveProfile } from "./profile"
import { readWindowBounds, trackWindowBounds } from "./services/windowState"
import { createMainWindow, createSettingsWindow } from "./window"

const SETTINGS_IDLE_RELEASE_MS = 10 * 60 * 1000
const CASCADE_OFFSET = 24
const GLOBAL_MIRRORS = new Set(["recent-vaults", "auth", "subscription", "global-settings"])

interface MainWindowEntry {
	window: BrowserWindow
	vaultPath: string | null
	ready: boolean
	pending: ((contents: WebContents) => void)[]
}

const mainWindows = new Map<number, MainWindowEntry>()
const claimedKeys = new Set<string>()
const windowListeners = new Set<() => void>()
const closedListeners = new Set<(contentsId: number) => void>()
let lastFocusedMainId: number | null = null
let settingsWindow: BrowserWindow | null = null
let settingsBoundTo: number | null = null
let settingsReleaseTimer: NodeJS.Timeout | null = null
let settingsReady = false
const settingsPending: WindowMessage[] = []
let quitting = false
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

function sendMessage(contents: WebContents, message: WindowMessage): void {
	if (!contents.isDestroyed()) contents.send(`${EVENT_CHANNEL_PREFIX}window-message`, message)
}

function notifyWindowsChanged(): void {
	for (const listener of windowListeners) listener()
}

export function onWindowsChanged(listener: () => void): () => void {
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

function cancelSettingsRelease(): void {
	if (settingsReleaseTimer) clearTimeout(settingsReleaseTimer)
	settingsReleaseTimer = null
}

function ensureSettingsWindow(): BrowserWindow {
	cancelSettingsRelease()
	if (isAlive(settingsWindow)) return settingsWindow
	if (!urls) throw new Error("Windows are not configured")
	const window = createSettingsWindow(rendererUrl({ window: "settings" }), urls.preload)
	settingsReady = false
	settingsPending.length = 0
	keepTitle(window, withProfile("Settings"))
	window.on("close", (event) => {
		if (quitting || mainWindows.size === 0) return
		event.preventDefault()
		window.hide()
		cancelSettingsRelease()
		settingsReleaseTimer = setTimeout(() => {
			settingsReleaseTimer = null
			if (isAlive(window) && !window.isVisible()) window.destroy()
		}, SETTINGS_IDLE_RELEASE_MS)
	})
	window.on("closed", () => {
		if (settingsWindow !== window) return
		settingsWindow = null
		settingsReady = false
		settingsPending.length = 0
	})
	settingsWindow = window
	return window
}

function sendToSettings(window: BrowserWindow, message: WindowMessage): void {
	if (settingsReady) sendMessage(window.webContents, message)
	else settingsPending.push(message)
}

function bindSettingsTo(contentsId: number | null): void {
	if (settingsBoundTo === contentsId) return
	settingsBoundTo = contentsId
	const entry = contentsId === null ? null : mainWindows.get(contentsId)
	if (!entry) return
	sendMessage(entry.window.webContents, { type: "snapshot-request" })
	updateSettingsTitle()
}

function updateSettingsTitle(): void {
	if (!isAlive(settingsWindow)) return
	const vaultPath = settingsBoundTo === null ? null : mainWindows.get(settingsBoundTo)?.vaultPath
	settingsWindow.setTitle(withProfile(vaultPath ? `Settings — ${basename(vaultPath)}` : "Settings"))
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
	const entry: MainWindowEntry = { window, vaultPath, ready: false, pending: [] }
	mainWindows.set(contentsId, entry)
	lastFocusedMainId = contentsId
	trackWindowBounds(window, () => entry.vaultPath)

	window.on("focus", () => {
		lastFocusedMainId = contentsId
		bindSettingsTo(contentsId)
		notifyWindowsChanged()
	})
	window.webContents.on("did-start-navigation", (details) => {
		if (details.isMainFrame && !details.isSameDocument) entry.ready = false
	})
	window.on("closed", () => {
		mainWindows.delete(contentsId)
		for (const listener of closedListeners) listener(contentsId)
		if (lastFocusedMainId === contentsId) lastFocusedMainId = null
		if (settingsBoundTo === contentsId) {
			settingsBoundTo = null
			const next = getFocusedMainEntry()
			if (next) bindSettingsTo(next.window.webContents.id)
		}
		if (mainWindows.size === 0 && process.platform !== "darwin" && isAlive(settingsWindow)) {
			settingsWindow.destroy()
		}
		notifyWindowsChanged()
	})
	notifyWindowsChanged()
	return entry
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
	app.on("before-quit", () => {
		quitting = true
	})
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
	if (mainWindows.has(contentsId)) return contentsId
	if (isAlive(settingsWindow) && settingsWindow.webContents.id === contentsId)
		return settingsBoundTo
	return null
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

export function openSettingsWindow(section?: string | null, fieldId?: string | null): void {
	const created = !isAlive(settingsWindow)
	const window = ensureSettingsWindow()
	const sender = getInvokeSender()
	if (sender && mainWindows.has(sender.id)) bindSettingsTo(sender.id)
	else if (settingsBoundTo === null) {
		const entry = getFocusedMainEntry()
		if (entry) bindSettingsTo(entry.window.webContents.id)
	}
	if (section) sendToSettings(window, { type: "navigate", section, fieldId: fieldId ?? null })
	if (created) window.once("ready-to-show", () => focusWindow(window))
	else focusWindow(window)
}

function isGlobalMessage(message: WindowMessage): boolean {
	return message.type === "store" && GLOBAL_MIRRORS.has(String(message.name))
}

function relay(message: WindowMessage): void {
	const senderId = getInvokeSender()?.id
	const settings = isAlive(settingsWindow) ? settingsWindow.webContents : null
	const fromSettings = settings !== null && senderId === settings.id
	const bound = settingsBoundTo === null ? null : mainWindows.get(settingsBoundTo)

	if (isGlobalMessage(message)) {
		for (const [contentsId, entry] of mainWindows) {
			if (contentsId !== senderId) sendMessage(entry.window.webContents, message)
		}
		if (settings && !fromSettings) sendMessage(settings, message)
		return
	}
	if (fromSettings) {
		if (bound) sendMessage(bound.window.webContents, message)
		return
	}
	if (settings && senderId === settingsBoundTo) sendMessage(settings, message)
}

function setWindowVault(contents: WebContents, vaultPath: string | null): void {
	const entry = mainWindows.get(contents.id)
	if (!entry) return
	entry.vaultPath = vaultPath
	entry.window.setTitle(withProfile(vaultPath ? basename(vaultPath) : "Cortex"))
	if (process.platform === "darwin") entry.window.setRepresentedFilename(vaultPath ?? "")
	if (vaultPath) app.addRecentDocument(vaultPath)
	if (settingsBoundTo === contents.id) updateSettingsTitle()
	notifyWindowsChanged()
}

export const windowApi = {
	closeCurrent: async () => {
		const sender = getInvokeSender()
		if (sender) BrowserWindow.fromWebContents(sender)?.close()
	},
	focusMain: async () => {
		const bound = settingsBoundTo === null ? null : mainWindows.get(settingsBoundTo)
		if (bound) focusWindow(bound.window)
		else focusMainWindow()
	},
	restartApp: async () => {
		app.relaunch()
		app.exit(0)
	},
	openSettings: async (section, fieldId) => openSettingsWindow(section, fieldId),
	setColorScheme: async (scheme) => {
		nativeTheme.themeSource = scheme
	},
	relay: async (message) => relay(message),
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
		if (sender && isAlive(settingsWindow) && settingsWindow.webContents.id === sender.id) {
			settingsReady = true
			for (const message of settingsPending.splice(0)) sendMessage(sender, message)
			return
		}
		const entry = sender ? mainWindows.get(sender.id) : undefined
		if (!entry) return
		entry.ready = true
		const pending = entry.pending.splice(0)
		for (const run of pending) run(entry.window.webContents)
	},
} satisfies MainApi["window"]
