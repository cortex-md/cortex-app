import type { HotkeyOverrides } from "@cortex/hotkeys"
import type { Capabilities, Platform, WatchEvent, WatchOptions } from "@cortex/platform"
import type { JsonValue, PluginHostMessage, PluginUiMessage } from "@cortex/plugin-host-core"
import type {
	BookmarkEntry,
	TagEntry,
	WorkspaceMarkdownTab,
	WorkspaceOpenOptions,
} from "@cortex.md/api"
import type { DOMImperativeFactory } from "expo/dom"

import type { MobileEditorConfig } from "@/features/editor/editorContract"

/** Core state the workspace WebView reads synchronously. Native sends it once, then changed keys. */
export interface WorkspaceState {
	vaultPath: string | null
	openFiles: string[]
	activeFilePath: string | null
	bookmarks: BookmarkEntry[]
	bookmarkedPaths: Record<string, true>
	tags: TagEntry[]
	themeName: string
	editorConfig: MobileEditorConfig
	themeTokens: Record<string, string>
	hotkeyOverrides: HotkeyOverrides
	capabilities: Capabilities[]
	allowCommunityPlugins: boolean
}

export interface WorkspaceDocument {
	filePath: string
	body: string
	revision: number
	frontmatterMeta: Record<string, unknown>
	frontmatterError: string | null
}

export interface WorkspaceCursor {
	line: number
	column: number
	offset: number
}

export type WorkspaceServiceCall =
	| { kind: "openFile"; path: string }
	| { kind: "openView"; viewKey: string }
	| {
			kind: "openMarkdownTab"
			pluginId: string
			tab: WorkspaceMarkdownTab
			options?: WorkspaceOpenOptions
	  }
	| { kind: "bookmark"; action: "add" | "remove" | "toggle"; path: string; force?: boolean }
	| { kind: "watch"; path: string; options?: WatchOptions }
	| { kind: "unwatch"; watchId: number }

export interface WorkspaceFindResult {
	current: number
	total: number
}

/** Answers the request with the same `id`; `value` is any JSON value. */
export type WorkspaceReply = { type: "reply"; id: number; value?: unknown; error?: string }

/** Native → workspace WebView, through the `receive` imperative handle. */
export type WorkspaceInboundMessage =
	| { type: "plugin"; message: PluginUiMessage }
	| { type: "state"; patch: Partial<WorkspaceState> }
	| { type: "openDocument"; document: WorkspaceDocument }
	| { type: "closeDocument"; id: number; filePath: string }
	| { type: "showEditor"; visible: boolean }
	| { type: "bottomInset"; value: number }
	| { type: "flush"; id: number }
	| { type: "watchEvent"; watchId: number; event: WatchEvent }
	| { type: "command"; commandId: string; payload?: JsonValue }
	| { type: "find"; id: number; query: string; direction?: "next" | "prev" }
	| WorkspaceReply

/** Workspace WebView → native, through the `send` async prop. Requests carry an `id`. */
export type WorkspaceOutboundMessage =
	| { type: "ready" }
	| { type: "plugin"; message: PluginHostMessage }
	| { type: "commit"; id: number; filePath: string; body: string; revision: number }
	| { type: "cursor"; cursor: WorkspaceCursor }
	| { type: "platformCall"; id: number; domain: string; method: string; args: unknown[] }
	| { type: "serviceCall"; id: number; call: WorkspaceServiceCall }
	| { type: "command"; commandId: string; payload: JsonValue }
	| { type: "communityStyles"; css: string }
	| WorkspaceReply

/** The WebView's `useDOMImperativeHandle`: fire-and-forget, JSON arguments only. */
export type WorkspaceViewHandle = DOMImperativeFactory & {
	receive(message: WorkspaceInboundMessage): void
}

/** The only platform methods the WebView may call on native, all async and JSON-only. */
export const forwardedPlatformMethods = {
	fs: [
		"readFile",
		"readFileSnapshot",
		"readTextFiles",
		"writeFile",
		"atomicWriteFile",
		"deleteFile",
		"renameFile",
		"createDir",
		"listDir",
		"hashFile",
		"getFileMetadata",
	],
	notifications: ["getPermission", "requestPermission", "send"],
	app: ["getCurrentAppVersion", "openExternalUrl", "resolveFileAssetUrl"],
	clipboard: ["readText", "writeText"],
} as const satisfies { [Domain in keyof Platform]?: readonly (keyof Platform[Domain])[] }

export type ForwardedPlatformDomain = keyof typeof forwardedPlatformMethods

export function isForwardedPlatformMethod(
	domain: string,
	method: string,
): domain is ForwardedPlatformDomain {
	const methods: readonly string[] | undefined =
		forwardedPlatformMethods[domain as ForwardedPlatformDomain]
	return Object.hasOwn(forwardedPlatformMethods, domain) && methods?.includes(method) === true
}

export interface WorkspaceRequests {
	request<T>(send: (id: number) => void): Promise<T>
	settle(reply: WorkspaceReply): void
	rejectAll(reason: string): void
}

export function createWorkspaceRequests(): WorkspaceRequests {
	const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>()
	let nextId = 0
	return {
		request<T>(send: (id: number) => void) {
			const id = ++nextId
			return new Promise<T>((resolve, reject) => {
				pending.set(id, { resolve: (value) => resolve(value as T), reject })
				send(id)
			})
		},
		settle(reply) {
			const request = pending.get(reply.id)
			pending.delete(reply.id)
			if (reply.error === undefined) request?.resolve(reply.value)
			else request?.reject(new Error(reply.error))
		},
		rejectAll(reason) {
			for (const request of pending.values()) request.reject(new Error(reason))
			pending.clear()
		},
	}
}

export function answerWorkspaceRequest(
	id: number,
	run: () => unknown,
	send: (reply: WorkspaceReply) => void,
): void {
	Promise.resolve()
		.then(run)
		.then(
			(value) => send({ type: "reply", id, value }),
			(error: unknown) =>
				send({ type: "reply", id, error: error instanceof Error ? error.message : String(error) }),
		)
}
