/** Handle returned by every registration or subscription. Call `dispose()` to remove it early. */
export interface Disposable {
	dispose(): void
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

/** Host context menu surface where an item can appear. */
export type ContextMenuLocation = "file" | "editor" | "tab"

/** Context payload supplied when a registered context menu item runs. */
export type ContextMenuActionContext =
	| { location: "file"; filePath: string }
	| { location: "editor"; filePath: string | null; selection?: { from: number; to: number } }
	| { location: "tab"; tabId: string; filePath?: string; viewId?: string }

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
