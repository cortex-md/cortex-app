import { type CommandEntry, executeCommand, registerCommands } from "@cortex/commands"
import {
	createCoreServices,
	type NoteDocumentSession,
	openPluginMarkdownTab,
	useEditorStore,
} from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { createPluginUiMirror, type JsonValue } from "@cortex/plugin-host-core"
import type { ReactNode, RefObject } from "react"

import { openMobileNote } from "@/bootstrap/appCommands"
import { saveNoteImage } from "@/features/note/noteImageFiles"
import { openPluginView } from "@/features/plugins/openPluginView"
import { receiveCollabBridgeMessage } from "@/features/workspace/collabBridge"
import {
	answerWorkspaceRequest,
	type CollabBridgeMessage,
	createWorkspaceRequests,
	type EditorCommandSummary,
	isForwardedPlatformMethod,
	type WorkspaceDocument,
	type WorkspaceFindResult,
	type WorkspaceInboundMessage,
	type WorkspaceOutboundMessage,
	type WorkspaceServiceCall,
	type WorkspaceViewHandle,
} from "@/features/workspace/workspaceProtocol"
import {
	startWorkspaceStatePublisher,
	type WorkspaceStatePublisher,
} from "@/features/workspace/workspaceState"

export interface WorkspaceRect {
	x: number
	y: number
	width: number
	height: number
}

export interface WorkspaceLayout {
	owner: object | null
	rect: WorkspaceRect | null
	visible: boolean
}

export interface WorkspaceChrome {
	owner: object | null
	node: ReactNode
}

const STALE_COMMIT_ERROR = "The note changed before this mobile editor commit could be applied."

const coreServices = createCoreServices()
const requests = createWorkspaceRequests()
const sessions = new Map<string, NoteDocumentSession[]>()
const watchers = new Map<number, () => void>()
const layoutListeners = new Set<() => void>()
const styleListeners = new Set<() => void>()
const chromeListeners = new Set<() => void>()

let viewRef: RefObject<WorkspaceViewHandle | null> | null = null
let publisher: WorkspaceStatePublisher | null = null
let connected = false
let queue: WorkspaceInboundMessage[] = []
let shownDocument: WorkspaceDocument | null = null
let layout: WorkspaceLayout = { owner: null, rect: null, visible: false }
let chrome: WorkspaceChrome = { owner: null, node: null }
let bottomInset = 0
let communityStyles = ""

const pluginUiMirror = createPluginUiMirror({
	send: (message) => post({ type: "plugin", message }),
	getVaultPath: coreServices.getVaultPath,
})

function post(message: WorkspaceInboundMessage): void {
	const handle = viewRef?.current
	if (connected && handle) {
		handle.receive(message)
		return
	}
	if (message.type === "plugin" || message.type === "closeDocument" || message.type === "collab") {
		queue.push(message)
	}
}

function stopWatchers(): void {
	for (const stop of watchers.values()) stop()
	watchers.clear()
}

function setCommunityStyles(css: string): void {
	if (css === communityStyles) return
	communityStyles = css
	for (const listener of styleListeners) listener()
}

function resetConnection(reason: string): void {
	pluginUiMirror.dispose()
	requests.rejectAll(reason)
	stopWatchers()
	setCommunityStyles("")
	queue = []
}

function handleReady(): void {
	if (connected) resetConnection("The workspace WebView reloaded")
	connected = true
	const handle = viewRef?.current
	if (!handle || !publisher) return
	handle.receive({ type: "state", patch: publisher.snapshot() })
	if (shownDocument) handle.receive({ type: "openDocument", document: shownDocument })
	handle.receive({ type: "showEditor", visible: layout.visible })
	handle.receive({ type: "bottomInset", value: bottomInset })
	const queued = queue
	queue = []
	for (const message of queued) handle.receive(message)
}

function commitDocument(filePath: string, body: string, revision: number): void {
	const session = sessions.get(filePath)?.at(-1)
	if (!session?.getSnapshot()) throw new Error("No note is open")
	if (!session.updateBody(body, { baseRevision: revision })) throw new Error(STALE_COMMIT_ERROR)
}

function callPlatform(domain: string, method: string, args: unknown[]): unknown {
	if (!isForwardedPlatformMethod(domain, method)) {
		throw new Error(`platform.${domain}.${method} is not available to the workspace WebView`)
	}
	const target = getPlatform()[domain] as unknown as Record<string, (...args: unknown[]) => unknown>
	return target[method](...args)
}

async function runServiceCall(id: number, call: WorkspaceServiceCall): Promise<unknown> {
	switch (call.kind) {
		case "openFile":
			openMobileNote(call.path)
			return null
		case "openView":
			openPluginView(call.viewKey)
			return null
		case "openMarkdownTab":
			openPluginMarkdownTab(call.pluginId, call.tab, call.options)
			return null
		case "bookmark":
			if (call.action === "toggle") return coreServices.bookmarks.toggle(call.path, call.force)
			return (await coreServices.bookmarks[call.action](call.path)) ?? null
		case "watch": {
			const stop = await getPlatform().fs.startWatching(
				call.path,
				(event) => post({ type: "watchEvent", watchId: id, event }),
				call.options,
			)
			watchers.set(id, stop)
			return null
		}
		case "unwatch":
			watchers.get(call.watchId)?.()
			watchers.delete(call.watchId)
			return null
		case "saveImage":
			return saveNoteImage(call.filePath, decodeBase64(call.base64), call.mimeType)
	}
}

function decodeBase64(value: string): Uint8Array {
	const binary = atob(value)
	const bytes = new Uint8Array(binary.length)
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
	return bytes
}

let unregisterEditorCommands: (() => void) | null = null

function registerEditorCommandProxies(commands: readonly EditorCommandSummary[]): void {
	unregisterEditorCommands?.()
	const entries: CommandEntry[] = commands.map((command) => ({
		id: command.id,
		label: command.label,
		category: command.category,
		aliases: command.aliases,
		execute: () => sendCommand(command.id),
	}))
	unregisterEditorCommands = registerCommands(entries)
}

async function receive(message: WorkspaceOutboundMessage): Promise<void> {
	switch (message.type) {
		case "ready":
			handleReady()
			return
		case "editorCommands":
			registerEditorCommandProxies(message.commands)
			return
		case "collab":
			receiveCollabBridgeMessage(message.message)
			return
		case "plugin":
			pluginUiMirror.receive(message.message)
			return
		case "commit":
			answerWorkspaceRequest(
				message.id,
				() => commitDocument(message.filePath, message.body, message.revision),
				post,
			)
			return
		case "cursor":
			useEditorStore.getState().updateCursor({
				col: message.cursor.column,
				line: message.cursor.line,
				offset: message.cursor.offset,
			})
			return
		case "platformCall":
			answerWorkspaceRequest(
				message.id,
				() => callPlatform(message.domain, message.method, message.args),
				post,
			)
			return
		case "serviceCall":
			answerWorkspaceRequest(message.id, () => runServiceCall(message.id, message.call), post)
			return
		case "command":
			executeCommand(message.commandId, { source: "api", payload: message.payload })
			return
		case "communityStyles":
			setCommunityStyles(message.css)
			return
		case "reply":
			requests.settle(message)
	}
}

function sendCollab(message: CollabBridgeMessage): void {
	post({ type: "collab", message })
}

function sendCommand(commandId: string, payload?: JsonValue): void {
	post({ type: "command", commandId, payload })
}

function find(query: string, direction?: "next" | "prev"): Promise<WorkspaceFindResult> {
	if (!connected) return Promise.resolve({ current: 0, total: 0 })
	return requests.request<WorkspaceFindResult>((id) => post({ type: "find", id, query, direction }))
}

function attach(ref: RefObject<WorkspaceViewHandle | null>): () => void {
	viewRef = ref
	connected = false
	publisher = startWorkspaceStatePublisher((patch) => post({ type: "state", patch }))
	return () => {
		if (viewRef !== ref) return
		publisher?.stop()
		publisher = null
		viewRef = null
		connected = false
		resetConnection("The workspace WebView closed")
	}
}

/** Keeps a note session as the commit target; release flushes the WebView before disposing it. */
function registerDocument(session: NoteDocumentSession): () => void {
	const { filePath } = session
	sessions.set(filePath, [...(sessions.get(filePath) ?? []), session])
	return () => {
		const remove = () => {
			const remaining = (sessions.get(filePath) ?? []).filter((entry) => entry !== session)
			if (remaining.length > 0) sessions.set(filePath, remaining)
			else sessions.delete(filePath)
			session.dispose()
		}
		if ((sessions.get(filePath)?.length ?? 0) > 1) {
			remove()
			return
		}
		if (shownDocument?.filePath === filePath) shownDocument = null
		requests
			.request((id) => post({ type: "closeDocument", id, filePath }))
			.catch(() => {})
			.finally(remove)
	}
}

function showDocument(document: WorkspaceDocument): void {
	shownDocument = document
	post({ type: "openDocument", document })
}

function setLayout(next: WorkspaceLayout): void {
	const visibilityChanged = next.visible !== layout.visible
	layout = next
	for (const listener of layoutListeners) listener()
	if (visibilityChanged) post({ type: "showEditor", visible: next.visible })
}

function showEditor(owner: object, rect: WorkspaceRect): void {
	setLayout({ owner, rect, visible: true })
}

function hideEditor(owner: object): void {
	if (layout.owner !== owner) return
	setLayout({ owner: null, rect: layout.rect, visible: false })
}

/** Native chrome drawn over the bottom of the editor rectangle while `owner` shows the editor. */
function setChrome(owner: object, node: ReactNode): void {
	chrome = { owner, node }
	for (const listener of chromeListeners) listener()
}

function clearChrome(owner: object): void {
	if (chrome.owner !== owner) return
	chrome = { owner: null, node: null }
	for (const listener of chromeListeners) listener()
}

function setBottomInset(value: number): void {
	const next = Math.round(value)
	if (next === bottomInset) return
	bottomInset = next
	post({ type: "bottomInset", value: next })
}

/** Writes the WebView's debounced edits to the open note session. */
function flush(): Promise<void> {
	if (!connected) return Promise.resolve()
	return requests.request<void>((id) => post({ type: "flush", id }))
}

export const workspaceChannel = {
	attach,
	receive,
	pluginHost: pluginUiMirror.facade,
	registerDocument,
	showDocument,
	showEditor,
	hideEditor,
	setChrome,
	clearChrome,
	setBottomInset,
	flush,
	sendCommand,
	sendCollab,
	find,
	getLayout: () => layout,
	subscribeLayout(listener: () => void) {
		layoutListeners.add(listener)
		return () => {
			layoutListeners.delete(listener)
		}
	},
	getChrome: () => chrome,
	subscribeChrome(listener: () => void) {
		chromeListeners.add(listener)
		return () => {
			chromeListeners.delete(listener)
		}
	},
	getCommunityStyles: () => communityStyles,
	subscribeCommunityStyles(listener: () => void) {
		styleListeners.add(listener)
		return () => {
			styleListeners.delete(listener)
		}
	},
}
