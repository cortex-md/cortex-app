/** Handle returned by every registration or subscription. Call `dispose()` to remove it early. */
export interface Disposable {
	dispose(): void
}

/** Capabilities a plugin may request in `manifest.json` before using guarded host APIs. */
export type PluginCapability =
	| "vault:read"
	| "vault:write"
	| "vault:delete"
	| "vault:watch"
	| "editor:read"
	| "editor:write"
	| "editor:extensions"
	| "editor:folding"
	| "markdown:extensions"
	| "ui:views"
	| "ui:sidebar"
	| "ui:statusbar"
	| "ui:contextmenu"
	| "ui:modals"
	| "workspace:tabs"
	| "commands"
	| "settings"
	| "theme:read"
	| "bookmarks:read"
	| "bookmarks:write"
	| "properties:types"
	| "data"
	| "notifications"

/** Metadata loaded by the Cortex host before a plugin is constructed. */
export interface PluginManifest {
	/** Stable plugin id, usually reverse-DNS or package-like, unique within a vault. */
	id: string
	/** Human-readable plugin name shown in Cortex UI. */
	name: string
	/** Plugin version. Use semver for Marketplace and update comparisons. */
	version: string
	/** Minimum Cortex app version that can safely run this plugin. */
	minAppVersion: string
	/** Display name of the plugin author or organization. */
	author: string
	/** Optional public author URL. */
	authorUrl?: string
	/** Short explanation shown in Marketplace, plugin lists, and permission prompts. */
	description: string
	/** Lucide icon name or host-supported icon identifier. */
	icon: string
	/** Entry bundle path relative to the plugin root, for example `dist/index.js`. */
	main: string
	/** Host capabilities required by this plugin. Missing capabilities fail closed. */
	capabilities?: PluginCapability[]
}

/** Command registered into Cortex command palette, hotkey, and Vim command surfaces. */
export interface PluginCommand {
	/** Plugin-local command id. The host prefixes it internally. */
	id: string
	/** User-facing command label. */
	label: string
	/** Optional palette grouping label. */
	category?: string
	/** Additional search terms for command lookup. */
	aliases?: string[]
	/** Lucide icon name or host-supported icon identifier. */
	icon?: string
	/** @deprecated Use `defaultHotkey`; `shortcut` is retained for older plugin builds. */
	shortcut?: string
	/** Default configurable shortcut, such as `mod+shift+p`. */
	defaultHotkey?: string
	/** Work performed when the command is invoked. */
	execute: () => void | Promise<void>
}

/** Fold range returned by portable editor fold providers. Line numbers are 1-based. */
export interface PluginFoldRange {
	/** Last line included in the folded region. Must be greater than the current line. */
	toLine: number
	/** Optional concise label shown by hosts that support custom placeholders. */
	placeholder?: string
}

/** Context supplied when Cortex asks a plugin whether the current line can fold. */
export interface PluginFoldContext {
	/** Active note path, or null when the host cannot associate the editor with a file. */
	filePath: string | null
	/** Current line number, 1-based. */
	lineNumber: number
	/** Current line text. */
	lineText: string
	/** Total number of lines in the editor document. */
	lineCount: number
	/** Return a line's text by 1-based number, or null when out of bounds. */
	getLine(lineNumber: number): string | null
}

/** Portable editor fold provider. Requires the `editor:folding` capability. */
export interface PluginFoldProviderRegistration {
	id: string
	label?: string
	priority?: number
	getFoldRange(context: PluginFoldContext): PluginFoldRange | null
}

/** Current OS/host notification permission state. */
export type PluginNotificationPermissionState = "granted" | "denied" | "prompt" | "unsupported"

/** Semantic notification kind used by host presentation. */
export type PluginNotificationKind = "info" | "success" | "warning" | "error"

/** Delivery urgency hint. Hosts may ignore it on platforms without matching support. */
export type PluginNotificationUrgency = "low" | "normal" | "high"

/** Icon hint for native notifications. Asset paths are plugin-relative. */
export type PluginNotificationIcon =
	| { type: "app" }
	| { type: "lucide"; name: string }
	| { type: "asset"; path: string }

/** Sound hint for native notifications. Asset paths are plugin-relative. */
export type PluginNotificationSound =
	| { type: "default" }
	| { type: "system"; name: string }
	| { type: "asset"; path: string }

/** Native host notification request. Requires the `notifications` capability. */
export interface PluginNotification {
	/** Optional stable id used by hosts for dedupe or replacement when supported. */
	id?: string
	title: string
	body?: string
	kind?: PluginNotificationKind
	icon?: PluginNotificationIcon
	sound?: PluginNotificationSound
	tag?: string
	silent?: boolean
	urgency?: PluginNotificationUrgency
	metadata?: Record<string, string | number | boolean | null>
}

/** Reason a notification could not be delivered. */
export type PluginNotificationFailureReason =
	| "missing-capability"
	| "unsupported"
	| "permission-denied"
	| "rate-limited"
	| "invalid"
	| "failed"

/** Delivery result returned by `api.notifications.send(...)`. */
export interface PluginNotificationResult {
	delivered: boolean
	reason?: PluginNotificationFailureReason
}

/** Vault file or directory entry. Paths are vault-relative and use forward slashes. */
export interface FileEntry {
	path: string
	name: string
	isDir: boolean
	size?: number
	mtime?: number
}

/** Bookmark entry. Paths are vault-relative Markdown file paths and use forward slashes. */
export interface BookmarkEntry {
	path: string
	addedAt: number
}

/** Result returned by bookmark toggle operations. */
export interface BookmarkToggleResult {
	bookmarked: boolean
	bookmark: BookmarkEntry | null
}

/** Event emitted by the vault watcher. Paths are vault-relative. */
export interface VaultFileEvent {
	type: "create" | "modify" | "delete" | "rename"
	path: string
	oldPath?: string
}

/** Setting field rendered and persisted by the host for this plugin. */
export interface PluginSettingDefinition {
	/** Plugin-local settings key. */
	key: string
	label: string
	description?: string
	type: "text" | "number" | "boolean" | "select" | "slider" | "color" | "folder-path"
	default: unknown
	options?: { value: string; label: string }[]
	min?: number
	max?: number
	step?: number
	placeholder?: string
	onChange?: (newValue: unknown, oldValue: unknown) => void
}

/** Settings tab registration shown in Cortex settings surfaces. */
export interface SettingsTabRegistration {
	id: string
	label: string
	icon: string
	settings: PluginSettingDefinition[]
}

/** Portable declarative node names supported by the host view renderer. */
export type ViewNodeType =
	| "stack"
	| "row"
	| "text"
	| "heading"
	| "button"
	| "icon-button"
	| "input"
	| "textarea"
	| "toggle"
	| "checkbox"
	| "select"
	| "slider"
	| "icon"
	| "separator"
	| "list"
	| "list-item"
	| "scroll-area"
	| "badge"
	| "progress"
	| "empty"
	| "markdown"
	| "setting-row"
	| "item"
	| "alert"
	| "tabs"
	| "table"

/** Standard host-controlled size token. */
export type ViewSize = "sm" | "md" | "lg"
/** Semantic tone mapped to the active Cortex theme. */
export type ViewTone = "default" | "muted" | "accent" | "success" | "warning" | "danger"
/** Button style token mapped by the host. */
export type ViewButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger"
/** Portable spacing token for stack and row layouts. */
export type ViewGap = "none" | "xs" | "sm" | "md" | "lg"
/** Cross-axis alignment token. */
export type ViewAlign = "start" | "center" | "end" | "stretch"
/** Main-axis distribution token. */
export type ViewJustify = "start" | "center" | "end" | "between"
/** Host-defined scroll area sizing token. */
export type ViewScrollSize = "sm" | "md" | "lg" | "fill"
/** Input type subset that stays portable across desktop and future mobile hosts. */
export type ViewInputType = "text" | "search" | "number" | "password" | "color" | "date" | "time"
/** Alert tone mapped by the host. */
export type ViewAlertTone = "default" | "success" | "warning" | "danger"
/** Table cell alignment token. */
export type ViewTableAlign = "start" | "center" | "end"
/** Primitive table value allowed in portable view descriptors. */
export type ViewTableCellValue = string | number | boolean | null

/** Shared fields for container-like portable view nodes. */
export interface ViewNodeBase {
	/** Stable key used by React/web hosts and future renderers for child identity. */
	key?: string | number
	children?: ViewDescriptor
}

/** Vertical layout container. */
export interface ViewStackNode extends ViewNodeBase {
	type: "stack"
	gap?: ViewGap
	align?: ViewAlign
}

/** Horizontal layout container. */
export interface ViewRowNode extends ViewNodeBase {
	type: "row"
	gap?: ViewGap
	align?: ViewAlign
	justify?: ViewJustify
	wrap?: boolean
}

/** Plain themed text. */
export interface ViewTextNode {
	type: "text"
	key?: string | number
	value: string
	tone?: ViewTone
	size?: ViewSize
	weight?: "regular" | "medium" | "semibold"
}

/** Compact section heading for plugin views. */
export interface ViewHeadingNode {
	type: "heading"
	key?: string | number
	value: string
	level?: 2 | 3 | 4
}

/** Command button. `action` is sent to the view dispatch/reducer when clicked. */
export interface ViewButtonNode extends ViewNodeBase {
	type: "button"
	label: string
	icon?: string
	variant?: ViewButtonVariant
	size?: ViewSize
	action?: string
	payload?: unknown
	disabled?: boolean
}

/** Icon-only command button with required accessible label. */
export interface ViewIconButtonNode {
	type: "icon-button"
	key?: string | number
	label: string
	icon: string
	variant?: ViewButtonVariant
	size?: ViewSize
	action?: string
	payload?: unknown
	disabled?: boolean
}

/** Single-line input. `action` receives the changed value as payload. */
export interface ViewInputNode {
	type: "input"
	key?: string | number
	label?: string
	inputType?: ViewInputType
	value?: string | number
	placeholder?: string
	min?: number
	max?: number
	step?: number
	action?: string
	disabled?: boolean
}

/** Multi-line input. `action` receives the changed value as payload. */
export interface ViewTextareaNode {
	type: "textarea"
	key?: string | number
	label?: string
	value?: string
	placeholder?: string
	action?: string
	disabled?: boolean
}

/** Binary switch. `action` receives the changed checked state as payload. */
export interface ViewToggleNode {
	type: "toggle"
	key?: string | number
	label: string
	checked: boolean
	action?: string
	disabled?: boolean
}

/** Binary checkbox. `action` receives the changed checked state as payload. */
export interface ViewCheckboxNode {
	type: "checkbox"
	key?: string | number
	label: string
	checked: boolean
	action?: string
	disabled?: boolean
}

/** Select option value and label. */
export interface ViewSelectOption {
	value: string
	label: string
}

/** Compact option picker. `action` receives the selected value as payload. */
export interface ViewSelectNode {
	type: "select"
	key?: string | number
	label?: string
	value?: string
	options: ViewSelectOption[]
	action?: string
	disabled?: boolean
}

/** Numeric slider. `action` receives the changed number as payload. */
export interface ViewSliderNode {
	type: "slider"
	key?: string | number
	label?: string
	value: number
	min?: number
	max?: number
	step?: number
	action?: string
	disabled?: boolean
}

/** Decorative or semantic icon. `label` should be provided when the icon conveys meaning. */
export interface ViewIconNode {
	type: "icon"
	key?: string | number
	name: string
	label?: string
	tone?: ViewTone
	size?: ViewSize
}

/** Themed separator line. */
export interface ViewSeparatorNode {
	type: "separator"
	key?: string | number
}

/** Semantic list container. */
export interface ViewListNode extends ViewNodeBase {
	type: "list"
}

/** Clickable or static list item. */
export interface ViewListItemNode extends ViewNodeBase {
	type: "list-item"
	action?: string
	payload?: unknown
	disabled?: boolean
}

/** Host-sized scroll viewport. */
export interface ViewScrollAreaNode extends ViewNodeBase {
	type: "scroll-area"
	size?: ViewScrollSize
}

/** Compact themed badge. */
export interface ViewBadgeNode {
	type: "badge"
	key?: string | number
	value: string
	tone?: ViewTone
}

/** Progress indicator. Omit `value` for indeterminate progress. */
export interface ViewProgressNode {
	type: "progress"
	key?: string | number
	value?: number
	label?: string
}

/** Empty-state block for a view or section. */
export interface ViewEmptyNode {
	type: "empty"
	key?: string | number
	message: string
	icon?: string
}

/** Render markdown content inside a plugin view. Content is sanitized by the host. */
export interface ViewMarkdownNode {
	type: "markdown"
	key?: string | number
	content: string
}

/** Settings-style row container for declarative views. */
export interface ViewSettingRowNode extends ViewNodeBase {
	type: "setting-row"
	label: string
	description?: string
	disabled?: boolean
}

/** Dense row item commonly used in pickers, browsers, and side panels. */
export interface ViewItemNode extends ViewNodeBase {
	type: "item"
	title: string
	description?: string
	icon?: string
	badge?: string
	action?: string
	payload?: unknown
	disabled?: boolean
}

/** Inline alert block rendered with host theme colors. */
export interface ViewAlertNode extends ViewNodeBase {
	type: "alert"
	title?: string
	message?: string
	icon?: string
	tone?: ViewAlertTone
}

/** Tab item inside a portable tabs node. */
export interface ViewTabItem {
	value: string
	label: string
	icon?: string
	children: ViewDescriptor
	disabled?: boolean
}

/** Portable tab control. `action` receives the selected tab value as payload. */
export interface ViewTabsNode {
	type: "tabs"
	key?: string | number
	value: string
	tabs: ViewTabItem[]
	action?: string
}

/** Table column definition. Cell values are read from each row's `cells[column.key]`. */
export interface ViewTableColumn {
	key: string
	label: string
	align?: ViewTableAlign
}

/** Table row definition. `action` is triggered when the row is activated. */
export interface ViewTableRow {
	key?: string | number
	cells: Record<string, ViewTableCellValue>
	action?: string
	payload?: unknown
	disabled?: boolean
}

/** Portable data table for compact plugin UI. */
export interface ViewTableNode {
	type: "table"
	key?: string | number
	columns: ViewTableColumn[]
	rows: ViewTableRow[]
	emptyMessage?: string
}

/** Any portable node that Cortex can render without plugin-owned DOM or React components. */
export type ViewNode =
	| ViewStackNode
	| ViewRowNode
	| ViewTextNode
	| ViewHeadingNode
	| ViewButtonNode
	| ViewIconButtonNode
	| ViewInputNode
	| ViewTextareaNode
	| ViewToggleNode
	| ViewCheckboxNode
	| ViewSelectNode
	| ViewSliderNode
	| ViewIconNode
	| ViewSeparatorNode
	| ViewListNode
	| ViewListItemNode
	| ViewScrollAreaNode
	| ViewBadgeNode
	| ViewProgressNode
	| ViewEmptyNode
	| ViewMarkdownNode
	| ViewSettingRowNode
	| ViewItemNode
	| ViewAlertNode
	| ViewTabsNode
	| ViewTableNode

/** A single portable view node or a list of sibling nodes. */
export type ViewDescriptor = ViewNode | ViewNode[]

/** State passed into a registered view renderer. */
export interface ViewState {
	state: Record<string, unknown>
}

/** Dispatch function passed into a view renderer for host-mediated actions. */
export type ViewDispatch = (action: string, payload?: unknown) => void

/** Declarative view registration for tabs, sidebars, and modals. */
export interface ViewRegistration {
	/** Plugin-local view id. */
	id: string
	label: string
	icon: string
	/** Host surface where this view is allowed to render. */
	location: "tab" | "sidebar-left" | "sidebar-right" | "modal"
	/** Pure render function from view state to portable descriptors. */
	render: (state: ViewState, dispatch: ViewDispatch) => ViewDescriptor
	/** Initial serializable state for the host-owned view instance. */
	initialState?: Record<string, unknown>
	/** Optional reducer that updates host-owned state for dispatched actions. */
	reduce?: (
		state: Record<string, unknown>,
		action: string,
		payload?: unknown,
	) => Record<string, unknown>
}

/** Sidebar entry that opens an already registered view. */
export interface SidebarItemRegistration {
	id: string
	label: string
	icon: string
	viewId: string
}

/** Status bar entry. Keep callbacks small and avoid long-running work in `onClick`. */
export interface StatusBarItemRegistration {
	id: string
	position: "left" | "right"
	text?: string
	icon?: string
	tooltip?: string
	onClick?: () => void
}

/** Host context menu surface where an item can appear. */
export type ContextMenuLocation = "file" | "editor" | "tab"

/** Context payload supplied when a registered context menu item runs. */
export type ContextMenuActionContext =
	| { location: "file"; filePath: string }
	| { location: "editor"; filePath: string | null; selection?: { from: number; to: number } }
	| { location: "tab"; tabId: string; filePath?: string; viewId?: string }

/** Context menu item registration. */
export interface ContextMenuItemRegistration {
	id: string
	label: string
	icon?: string
	location: ContextMenuLocation
	action: (context: ContextMenuActionContext) => void | Promise<void>
}

/** Simple inline markdown replacement used before full semantic transforms. */
export type MarkdownInlineReplacement =
	| { type: "text"; content: string | ((match: RegExpExecArray) => string) }
	| { type: "mark"; className: string }

/** Regex-based markdown registration for lightweight text or mark replacements. */
export interface MarkdownInlineRegistration {
	id: string
	/** Regex source string. Do not include leading/trailing slash delimiters. */
	pattern: string
	flags?: string
	priority?: number
	replacement: MarkdownInlineReplacement
}

/** Markdown surfaces that run full document preprocessors/processors. */
export type MarkdownSurface = "reading-view" | "export"

/** Markdown surfaces that can run portable semantic transforms. */
export type MarkdownSemanticSurface = MarkdownSurface | "live-preview"

/** Unified pipeline phase for advanced markdown processors. */
export type MarkdownProcessorPhase = "remark" | "rehype"

/** Minimal Unified-compatible node shape exposed without depending on Unified packages. */
export interface MarkdownUnifiedNode {
	type: string
	children?: MarkdownUnifiedNode[]
	[property: string]: unknown
}

/** Minimal VFile-compatible shape exposed without depending on VFile packages. */
export interface MarkdownUnifiedFile {
	data: Record<string, unknown>
	path?: string
	value: unknown
	[property: string]: unknown
}

/** Advanced Unified transformer shape for reading/export processors. */
export type MarkdownUnifiedTransformer = (
	tree: MarkdownUnifiedNode,
	file: MarkdownUnifiedFile,
) => unknown

/** Advanced Unified plugin factory. Keep dependencies bundled in your plugin. */
export type MarkdownUnifiedPlugin = () => MarkdownUnifiedTransformer | undefined

/** Sanitizable portable markdown node returned by semantic registrations. */
export type MarkdownPortableNode =
	| { type: "text"; value: string }
	| { type: "container"; children: readonly MarkdownPortableNode[] }
	| { type: "span"; className?: string; children: readonly MarkdownPortableNode[] }
	| { type: "link"; href: string; children: readonly MarkdownPortableNode[] }
	| { type: "image"; src: string; alt: string }
	| { type: "code"; value: string; language?: string }

/** Selector for semantic transforms. Currently text-only by design. */
export interface MarkdownNodeSelector {
	type: "text"
}

/** Context supplied to semantic markdown transforms. */
export interface MarkdownSemanticContext {
	surface: MarkdownSemanticSurface
	node: MarkdownPortableNode
	source: string
}

/** Portable semantic transform registration for Live Preview, Reading View, and export. */
export interface MarkdownSemanticRegistration {
	id: string
	selector: MarkdownNodeSelector
	priority?: number
	transform: (
		context: MarkdownSemanticContext,
	) => MarkdownPortableNode | readonly MarkdownPortableNode[] | null
}

/** Callout type registration shared across markdown surfaces. */
export interface CalloutTypeRegistration {
	/** Canonical callout name, such as `tip` or `warning`. */
	type: string
	aliases?: string[]
	label?: string
	color?: string
	backgroundColor?: string
}

/** Context supplied to markdown preprocessors. */
export interface MarkdownPreprocessorContext {
	surface: MarkdownSurface
}

/** String preprocessor for markdown before rendering/export. */
export interface MarkdownPreprocessorRegistration {
	id: string
	surfaces: readonly MarkdownSurface[]
	priority?: number
	preprocess: (markdown: string, context: MarkdownPreprocessorContext) => string | Promise<string>
}

/** Advanced Unified processor registration for reading/export only. */
export interface MarkdownProcessorRegistration {
	id: string
	phase: MarkdownProcessorPhase
	surfaces: readonly MarkdownSurface[]
	priority?: number
	processor: MarkdownUnifiedPlugin
}

/** Tag usage entry returned by metadata APIs. */
export interface TagEntry {
	tag: string
	count: number
}

/** Built-in storage/validation base types for plugin-defined note property types. */
export type PluginPropertyBaseType =
	| "text"
	| "number"
	| "select"
	| "person"
	| "date"
	| "checkbox"
	| "url"
	| "email"
	| "phone"

/** Validation result for a plugin-defined property value. */
export interface PluginPropertyValidationResult {
	valid: boolean
	message?: string
}

/** Custom note property type registration. */
export interface PluginPropertyTypeRegistration {
	type: string
	baseType: PluginPropertyBaseType
	displayName: string
	icon: string
	deserialize(value: unknown): unknown
	serialize(value: unknown): unknown
	validate(value: unknown): PluginPropertyValidationResult
}

/** Where a file, view, or temporary tab should open relative to the workspace. */
export type WorkspaceOpenTarget = "active" | "left" | "right" | "top" | "bottom"

/** Workspace opening behavior. Hosts may adapt split targets to available layouts. */
export interface WorkspaceOpenOptions {
	target?: WorkspaceOpenTarget
	newTab?: boolean
}

/** Temporary markdown tab that is not written to the vault. */
export interface WorkspaceMarkdownTab {
	id?: string
	title: string
	content: string
}

/** Options for opening a registered modal view. */
export interface ModalOpenOptions {
	title?: string
	initialState?: Record<string, unknown>
}

/** Capability-guarded host API injected into every `CortexPlugin` instance. */
export interface PluginAPI {
	/** Command palette, hotkey, and Vim command integration. Requires `commands`. */
	commands: {
		/** Register a plugin-local command. Dispose to remove it from every command surface. */
		register(command: PluginCommand): Disposable
		/** Execute a command by id. Returns false when no command is available. */
		execute(commandId: string): boolean
	}

	/** Plugin settings storage and schema. Requires `settings`. */
	settings: {
		/** Load persisted settings before reading them. The host calls this during plugin enablement. */
		load(): Promise<void>
		/** Read a setting value by key. Returns undefined when no value or default is available. */
		get<T>(key: string): T | undefined
		/** Persist a setting value. */
		set<T>(key: string, value: T): Promise<void>
		/** Return a snapshot of every known setting value for this plugin. */
		getAll(): Record<string, unknown>
		/** Subscribe to a setting change. Dispose to unsubscribe. */
		onChange(key: string, callback: (value: unknown, oldValue: unknown) => void): Disposable
		/** Define or replace this plugin's settings schema. */
		defineSchema(schema: PluginSettingDefinition[]): void
	}

	/** Vault filesystem access. Paths are vault-relative. */
	vault: {
		/** Return the current vault root path, or null when no vault is open. Requires `vault:read`. */
		getVaultPath(): string | null
		/** Read a UTF-8 text file from the vault. Requires `vault:read`. */
		readFile(relativePath: string): Promise<string>
		/** Write a UTF-8 text file in the vault. Requires `vault:write`. */
		writeFile(relativePath: string, content: string): Promise<void>
		/** Delete a file from the vault. Requires `vault:delete`. */
		deleteFile(relativePath: string): Promise<void>
		/** List files in a vault-relative directory. Requires `vault:read`. */
		listFiles(dir?: string): Promise<FileEntry[]>
		/** Check whether a vault-relative path exists. Requires `vault:read`. */
		exists(relativePath: string): Promise<boolean>
		/** Subscribe to vault file events. Requires `vault:watch`. */
		onFileEvent(callback: (event: VaultFileEvent) => void): Disposable
	}

	/** Active editor integration. Read/write methods require their matching editor capabilities. */
	editor: {
		/** Register a host-specific editor extension. Requires `editor:extensions`. */
		registerExtension(extension: unknown): Disposable
		/** Register a portable fold provider. Requires `editor:folding`. */
		registerFoldProvider(provider: PluginFoldProviderRegistration): Disposable
		/** Return the active note path, or null when no note editor is active. Requires `editor:read`. */
		getActiveFilePath(): string | null
		/** Return active note content, or null when unavailable. Requires `editor:read`. */
		getActiveFileContent(): string | null
		/** Insert text at the current editor cursor. Requires `editor:write`. */
		insertAtCursor(text: string): void
		/** Replace the current editor selection. Requires `editor:write`. */
		replaceSelection(text: string): void
	}

	/** Markdown extension points. Requires `markdown:extensions`. */
	markdown: {
		/** Register a regex inline replacement. */
		registerInline(registration: MarkdownInlineRegistration): Disposable
		/** Register a portable semantic transform. */
		registerSemantic(registration: MarkdownSemanticRegistration): Disposable
		/** Register a string preprocessor for reading/export surfaces. */
		registerPreprocessor(preprocessor: MarkdownPreprocessorRegistration): Disposable
		/** Register an advanced Unified processor for reading/export surfaces. */
		registerProcessor(processor: MarkdownProcessorRegistration): Disposable
		/** Register or override a callout type. */
		registerCalloutType(registration: CalloutTypeRegistration): Disposable
	}

	/** Note property extension points. Requires `properties:types`. */
	properties: {
		/** Register a custom property type. */
		registerType(registration: PluginPropertyTypeRegistration): Disposable
	}

	/** Declarative host UI registration. */
	ui: {
		/** Register a portable view. Requires `ui:views`. */
		registerView(registration: ViewRegistration): Disposable
		/** Add a sidebar item for a registered view. Requires `ui:sidebar`. */
		registerSidebarItem(item: SidebarItemRegistration): Disposable
		/** Add a status bar item. Requires `ui:statusbar`. */
		registerStatusBarItem(item: StatusBarItemRegistration): Disposable
		/** Add a context menu item. Requires `ui:contextmenu`. */
		registerContextMenuItem(item: ContextMenuItemRegistration): Disposable
		/** Register a settings tab. Requires `settings`. */
		registerSettingsTab(tab: SettingsTabRegistration): Disposable
		/** Open a registered modal view. Requires `ui:modals`. */
		openModal(viewId: string, options?: ModalOpenOptions): string | null
		/** Close a modal instance by id. Requires `ui:modals`. */
		closeModal(instanceId: string): void
		/** Show a lightweight host notice. Requires `notifications`. */
		showNotice(message: string, duration?: number): void
	}

	/** Native host notifications. Requires `notifications`. */
	notifications: {
		/** Whether this host can attempt native notifications. */
		isSupported(): boolean
		/** Current host/OS permission state. Plugins cannot request permission directly. */
		getPermission(): Promise<PluginNotificationPermissionState>
		/** Send a notification through the host. */
		send(notification: PluginNotification): Promise<PluginNotificationResult>
	}

	/** Read-only note metadata. */
	metadata: {
		/** Read parsed frontmatter for a vault-relative note path. */
		getFrontmatter(path: string): Promise<Record<string, unknown> | null>
		/** Return tags found in one note. */
		getTags(path: string): Promise<string[]>
		/** Return known tags for the current vault. */
		getAllTags(): TagEntry[]
	}

	/** Plugin-owned persistent data storage. Requires `data`. */
	data: {
		/** Read a plugin data file, or null when it does not exist. */
		read(filename: string): Promise<string | null>
		/** Write a plugin data file. */
		write(filename: string, content: string): Promise<void>
		/** Delete a plugin data file. */
		delete(filename: string): Promise<void>
		/** Return the host-owned data directory for this plugin. */
		getDataPath(): string
	}

	/** Theme read API. Requires `theme:read`. */
	theme: {
		/** Return the active Cortex theme name. */
		getActiveThemeName(): string
		/** Subscribe to theme changes. */
		onThemeChange(callback: (name: string) => void): Disposable
	}

	/** Workspace tab and file opening API. Requires `workspace:tabs` for open methods. */
	workspace: {
		/** Open a vault file in the workspace. */
		openFile(path: string, options?: WorkspaceOpenOptions): void
		/** Open a registered plugin view in the workspace. */
		openView(viewId: string, options?: WorkspaceOpenOptions): void
		/** Open temporary markdown content without writing it to the vault. */
		openMarkdownTab(tab: WorkspaceMarkdownTab, options?: WorkspaceOpenOptions): void
		/** Return currently open vault-relative file paths. */
		getOpenFiles(): string[]
		/** Subscribe to active file changes. */
		onActiveFileChange(callback: (path: string | null) => void): Disposable
	}

	/** Bookmark integration. Read and write methods require matching bookmark capabilities. */
	bookmarks: {
		/** Return all bookmarks in persisted order. Requires `bookmarks:read`. */
		list(): BookmarkEntry[]
		/** Add a vault-relative Markdown path. Requires `bookmarks:write`. */
		add(path: string): Promise<BookmarkEntry | null>
		/** Remove a vault-relative Markdown path. Requires `bookmarks:write`. */
		remove(path: string): Promise<void>
		/** Toggle a vault-relative Markdown path. Requires `bookmarks:write`. */
		toggle(path: string, force?: boolean): Promise<BookmarkToggleResult>
		/** Check whether a vault-relative Markdown path is bookmarked. Requires `bookmarks:read`. */
		isBookmarked(path: string): boolean
		/** Subscribe to bookmark list changes. Requires `bookmarks:read`. */
		onChange(callback: (bookmarks: BookmarkEntry[]) => void): Disposable
	}
}
