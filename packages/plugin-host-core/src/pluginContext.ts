import { getPlatform } from "@cortex/platform"
import type {
	BookmarkEntry,
	BookmarkToggleResult,
	Disposable,
	PluginContext,
	PluginFoldProviderRegistration,
	PluginManifest,
	PluginNotification,
	PluginPermission,
	TagEntry,
	VaultFileEvent,
	WorkspaceMarkdownTab,
	WorkspaceOpenOptions,
} from "@cortex.md/api"
import type { EditorViewLike } from "./editorViews"
import type { PluginMarkdownStyleHost } from "./pluginStyles"

export interface RegisteredEditorFoldProvider extends PluginFoldProviderRegistration {
	pluginId: string
	registrationKey: string
}

export interface EditorContributionSnapshot {
	extensions: unknown[]
	foldProviders: RegisteredEditorFoldProvider[]
}

export interface PluginHostServices {
	getVaultPath(): string | null
	workspace: {
		openFile(path: string, options?: WorkspaceOpenOptions): void
		openView(viewKey: string, label: string, options?: WorkspaceOpenOptions): void
		openMarkdownTab(
			pluginId: string,
			tab: WorkspaceMarkdownTab,
			options?: WorkspaceOpenOptions,
		): void
		getOpenFiles(): string[]
		subscribeActiveFile(callback: (path: string | null) => void): () => void
	}
	activeEditor: {
		getFilePath(): string | null
		getContent(): string | null
		insertAtCursor(text: string): void
		replaceSelection(text: string): void
	}
	editorRuntime?: {
		reconfigure(
			view: EditorViewLike,
			contributions: EditorContributionSnapshot,
			isCurrent: () => boolean,
		): unknown
	}
	bookmarks: {
		list(): BookmarkEntry[]
		add(path: string): Promise<BookmarkEntry | null>
		remove(path: string): Promise<void>
		toggle(path: string, force?: boolean): Promise<BookmarkToggleResult>
		isBookmarked(path: string): boolean
		subscribe(callback: (bookmarks: BookmarkEntry[]) => void): () => void
	}
	metadata: {
		parseFrontmatter(content: string): Record<string, unknown> | null
		extractTags(content: string): string[]
		getAllTags(): TagEntry[]
	}
	theme: {
		getActiveThemeName(): string
		subscribe(callback: (name: string) => void): () => void
	}
	community: CommunityPluginServices | null
}

export type ActiveEditorService = PluginHostServices["activeEditor"]

export interface CommunityPluginServices {
	styles: PluginMarkdownStyleHost
	loadEditorExternals(): Promise<Record<string, unknown>>
	isAllowed(): boolean
}

export interface PluginContextHost {
	services: PluginHostServices
	track(disposable: Disposable): Disposable
	getSetting(key: string): unknown
	getSettings(): Record<string, unknown>
	setSetting(key: string, value: unknown): Promise<void>
	onSettingChange(key: string, callback: (value: unknown, oldValue: unknown) => void): Disposable
	executeCommand(commandId: string, payload?: unknown): boolean
	openModal(
		viewId: string,
		options?: { title?: string; initialState?: Record<string, unknown> },
	): string | null
	closeModal(instanceId: string): void
	openView(viewId: string, options?: WorkspaceOpenOptions): void
	subscribeVaultFiles(callback: (event: VaultFileEvent) => void): () => void
}

const NOTIFICATION_RATE_LIMIT_WINDOW_MS = 30_000
const NOTIFICATION_RATE_LIMIT_MAX = 3
const notificationTimestamps = new Map<string, number[]>()

export function resetNotificationRateLimits(): void {
	notificationTimestamps.clear()
}

function isNotificationRateLimited(pluginId: string): boolean {
	const now = Date.now()
	const recent = (notificationTimestamps.get(pluginId) ?? []).filter(
		(timestamp) => now - timestamp < NOTIFICATION_RATE_LIMIT_WINDOW_MS,
	)
	const limited = recent.length >= NOTIFICATION_RATE_LIMIT_MAX
	if (!limited) recent.push(now)
	notificationTimestamps.set(pluginId, recent)
	return limited
}

function assertVaultRelativePath(path: string): void {
	if (path.includes("..") || path.startsWith("/") || path.startsWith("\\")) {
		throw new Error(`Path must be relative to vault root: ${path}`)
	}
}

function assertBookmarkPath(path: string): void {
	const normalized = path.replaceAll("\\", "/").trim()
	if (
		!normalized ||
		normalized.startsWith("/") ||
		/^[A-Za-z]:\//.test(normalized) ||
		normalized.startsWith(".cortex/") ||
		!normalized.toLocaleLowerCase().endsWith(".md") ||
		normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")
	) {
		throw new Error("Bookmarks only support Markdown files inside the active vault")
	}
}

function cloneBookmark(bookmark: BookmarkEntry): BookmarkEntry {
	return { path: bookmark.path, addedAt: bookmark.addedAt }
}

function toDisposable(unsubscribe: () => void): Disposable {
	return { dispose: unsubscribe }
}

type PermissionCheck = (permission: PluginPermission) => void

function createPermissionCheck(manifest: PluginManifest): PermissionCheck {
	const permissions = new Set<PluginPermission>(manifest.permissions ?? [])
	return (permission) => {
		if (!permissions.has(permission)) {
			throw new Error(`Plugin "${manifest.id}" requires the ${permission} permission`)
		}
	}
}

function createPluginEditorApi(
	requirePermission: PermissionCheck,
	activeEditor: ActiveEditorService,
): PluginContext["editor"] {
	return {
		getActiveFilePath() {
			requirePermission("editor:read")
			return activeEditor.getFilePath()
		},
		getActiveFileContent() {
			requirePermission("editor:read")
			return activeEditor.getContent()
		},
		insertAtCursor(text) {
			requirePermission("editor:write")
			activeEditor.insertAtCursor(text)
		},
		replaceSelection(text) {
			requirePermission("editor:write")
			activeEditor.replaceSelection(text)
		},
	}
}

export function createPluginContext(
	manifest: PluginManifest,
	host: PluginContextHost,
): PluginContext {
	const pluginId = manifest.id
	const { services } = host
	const permissions = new Set<PluginPermission>(manifest.permissions ?? [])
	const hasPermission = (permission: PluginPermission) => permissions.has(permission)
	const requirePermission = createPermissionCheck(manifest)

	function requireVaultPath(): string {
		const vaultPath = services.getVaultPath()
		if (!vaultPath) throw new Error("No vault is open")
		return vaultPath
	}

	function resolveVaultPath(relativePath: string): string {
		assertVaultRelativePath(relativePath)
		return `${requireVaultPath()}/${relativePath}`
	}

	function getDataDir(): string | null {
		const vaultPath = services.getVaultPath()
		return vaultPath ? `${vaultPath}/.cortex/plugins/${pluginId}/data` : null
	}

	function assertDataFilename(filename: string): void {
		if (filename.includes("..") || filename.startsWith("/") || filename.startsWith("\\")) {
			throw new Error(`Invalid data filename: ${filename}`)
		}
	}

	async function readVaultNote(path: string): Promise<string | null> {
		requirePermission("vault:read")
		assertVaultRelativePath(path)
		try {
			return await getPlatform().fs.readFile(resolveVaultPath(path))
		} catch {
			return null
		}
	}

	const notifications: PluginContext["notifications"] = {
		isSupported() {
			return hasPermission("notifications") && getPlatform().capabilities.includes("notifications")
		},
		async getPermission() {
			if (!hasPermission("notifications")) return "unsupported"
			return getPlatform().notifications.getPermission()
		},
		async send(notification: PluginNotification) {
			if (!hasPermission("notifications")) return { delivered: false, reason: "missing-capability" }
			if (!getPlatform().capabilities.includes("notifications")) {
				return { delivered: false, reason: "unsupported" }
			}
			if (!notification.title.trim()) return { delivered: false, reason: "invalid" }
			if (isNotificationRateLimited(pluginId)) return { delivered: false, reason: "rate-limited" }
			const platform = getPlatform()
			if ((await platform.notifications.getPermission()) !== "granted") {
				return { delivered: false, reason: "permission-denied" }
			}
			return platform.notifications.send({
				...notification,
				id: notification.id ? `${pluginId}:${notification.id}` : undefined,
				tag: notification.tag ? `${pluginId}:${notification.tag}` : undefined,
				source: "plugin",
				pluginId,
			})
		},
	}

	return {
		manifest,
		settings: {
			get: (key) => host.getSetting(key) as never,
			set: (key, value) => host.setSetting(key, value),
			getAll: () => host.getSettings() as never,
			onChange: (key, callback) =>
				host.onSettingChange(key, callback as (value: unknown, oldValue: unknown) => void),
		},
		commands: {
			execute: (commandId, payload) => host.executeCommand(commandId, payload),
		},
		ui: {
			openModal: (viewId, options) => host.openModal(viewId, options),
			closeModal: (instanceId) => host.closeModal(instanceId),
			showNotice(message) {
				requirePermission("notifications")
				void notifications.send({ title: manifest.name, body: message })
			},
		},
		workspace: {
			openFile(path, options) {
				requirePermission("workspace:tabs")
				services.workspace.openFile(path, options)
			},
			openView(viewId, options) {
				requirePermission("workspace:tabs")
				host.openView(viewId, options)
			},
			openMarkdownTab(tab, options) {
				requirePermission("workspace:tabs")
				services.workspace.openMarkdownTab(pluginId, tab, options)
			},
			getOpenFiles() {
				requirePermission("workspace:tabs")
				return services.workspace.getOpenFiles()
			},
			onActiveFileChange(callback) {
				requirePermission("workspace:tabs")
				return host.track(toDisposable(services.workspace.subscribeActiveFile(callback)))
			},
		},
		vault: {
			getVaultPath() {
				requirePermission("vault:read")
				return services.getVaultPath()
			},
			async readFile(relativePath) {
				requirePermission("vault:read")
				return getPlatform().fs.readFile(resolveVaultPath(relativePath))
			},
			async writeFile(relativePath, content) {
				requirePermission("vault:write")
				await getPlatform().fs.writeFile(resolveVaultPath(relativePath), content)
			},
			async deleteFile(relativePath) {
				requirePermission("vault:delete")
				await getPlatform().fs.deleteFile(resolveVaultPath(relativePath))
			},
			async listFiles(dir) {
				requirePermission("vault:read")
				return getPlatform().fs.listDir(dir ? resolveVaultPath(dir) : requireVaultPath())
			},
			async exists(relativePath) {
				requirePermission("vault:read")
				try {
					await getPlatform().fs.readFile(resolveVaultPath(relativePath))
					return true
				} catch {
					return false
				}
			},
			onFileEvent(callback) {
				requirePermission("vault:watch")
				return host.track(toDisposable(host.subscribeVaultFiles(callback)))
			},
		},
		editor: createPluginEditorApi(requirePermission, services.activeEditor),
		metadata: {
			async getFrontmatter(path) {
				const content = await readVaultNote(path)
				return content === null ? null : services.metadata.parseFrontmatter(content)
			},
			async getTags(path) {
				const content = await readVaultNote(path)
				return content === null ? [] : services.metadata.extractTags(content)
			},
			getAllTags() {
				requirePermission("vault:read")
				return services.metadata.getAllTags()
			},
		},
		data: {
			async read(filename) {
				requirePermission("data")
				assertDataFilename(filename)
				const dir = getDataDir()
				if (!dir) return null
				try {
					return await getPlatform().fs.readFile(`${dir}/${filename}`)
				} catch {
					return null
				}
			},
			async write(filename, content) {
				requirePermission("data")
				assertDataFilename(filename)
				const dir = getDataDir()
				if (!dir) return
				const platform = getPlatform()
				await platform.fs.createDir(dir)
				await platform.fs.writeFile(`${dir}/${filename}`, content)
			},
			async delete(filename) {
				requirePermission("data")
				assertDataFilename(filename)
				const dir = getDataDir()
				if (!dir) return
				try {
					await getPlatform().fs.deleteFile(`${dir}/${filename}`)
				} catch {}
			},
			getDataPath() {
				requirePermission("data")
				return getDataDir() ?? ""
			},
		},
		theme: {
			getActiveThemeName() {
				requirePermission("theme:read")
				return services.theme.getActiveThemeName()
			},
			onThemeChange(callback) {
				requirePermission("theme:read")
				return host.track(toDisposable(services.theme.subscribe(callback)))
			},
		},
		bookmarks: {
			list() {
				requirePermission("bookmarks:read")
				return services.bookmarks.list().map(cloneBookmark)
			},
			async add(path) {
				requirePermission("bookmarks:write")
				assertBookmarkPath(path)
				const bookmark = await services.bookmarks.add(path)
				return bookmark ? cloneBookmark(bookmark) : null
			},
			async remove(path) {
				requirePermission("bookmarks:write")
				assertBookmarkPath(path)
				await services.bookmarks.remove(path)
			},
			async toggle(path, force) {
				requirePermission("bookmarks:write")
				assertBookmarkPath(path)
				const result = await services.bookmarks.toggle(path, force)
				return {
					bookmarked: result.bookmarked,
					bookmark: result.bookmark ? cloneBookmark(result.bookmark) : null,
				}
			},
			isBookmarked(path) {
				requirePermission("bookmarks:read")
				assertBookmarkPath(path)
				return services.bookmarks.isBookmarked(path)
			},
			onChange(callback) {
				requirePermission("bookmarks:read")
				return host.track(
					toDisposable(
						services.bookmarks.subscribe((bookmarks) => callback(bookmarks.map(cloneBookmark))),
					),
				)
			},
		},
		notifications,
	}
}
