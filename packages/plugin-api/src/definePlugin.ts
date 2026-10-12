import type {
	BookmarkEntry,
	BookmarkToggleResult,
	CalloutTypeRegistration,
	ContextMenuLocation,
	Disposable,
	FileEntry,
	MarkdownInlineRegistration,
	MarkdownPreprocessorRegistration,
	MarkdownProcessorRegistration,
	MarkdownSemanticRegistration,
	ModalOpenOptions,
	PluginFoldProviderRegistration,
	PluginNotification,
	PluginNotificationPermissionState,
	PluginNotificationResult,
	PluginPropertyTypeRegistration,
	TagEntry,
	VaultFileEvent,
	ViewDescriptor,
	WorkspaceMarkdownTab,
	WorkspaceOpenOptions,
} from "./types"

/**
 * Runtime host APIs a plugin must request before calling them through its context.
 * Contributions (commands, views, settings, markdown, ...) never need a permission: declaring them
 * is the grant.
 */
export const PLUGIN_PERMISSIONS = [
	"vault:read",
	"vault:write",
	"vault:delete",
	"vault:watch",
	"editor:read",
	"editor:write",
	"workspace:tabs",
	"theme:read",
	"bookmarks:read",
	"bookmarks:write",
	"data",
	"notifications",
] as const

export type PluginPermission = (typeof PLUGIN_PERMISSIONS)[number]

/** Identity shown by Cortex. Lives inside the plugin's `definePlugin(...)` call. */
export interface PluginManifest {
	/** Stable plugin id, unique within a vault. */
	id: string
	name: string
	/** Semver version used by Marketplace update checks. */
	version: string
	minAppVersion: string
	author: string
	authorUrl?: string
	description: string
	/** Lucide icon name. */
	icon: string
	/** Bundle path relative to the plugin folder. Only community plugins need it. */
	main?: string
	/** Runtime APIs used by this plugin. Missing permissions fail closed. */
	permissions?: readonly PluginPermission[]
}

interface PluginSettingBase {
	label: string
	description?: string
}

export interface PluginSettingOption {
	value: string
	label: string
}

/** One field of the plugin settings schema. The host renders it and applies `default`. */
export type PluginSettingDefinition =
	| (PluginSettingBase & { type: "boolean"; default: boolean })
	| (PluginSettingBase & {
			type: "text" | "color" | "folder-path"
			default: string
			placeholder?: string
	  })
	| (PluginSettingBase & {
			type: "number" | "slider"
			default: number
			min?: number
			max?: number
			step?: number
	  })
	| (PluginSettingBase & {
			type: "select"
			default: string
			options: readonly PluginSettingOption[]
	  })

export type PluginSettingsSchema = Record<string, PluginSettingDefinition>

export type PluginSettingValue<Definition extends PluginSettingDefinition> = Definition extends {
	type: "boolean"
}
	? boolean
	: Definition extends { type: "number" | "slider" }
		? number
		: Definition extends { type: "select"; options: readonly (infer Option)[] }
			? Option extends { value: infer Value extends string }
				? Value
				: string
			: string

export type PluginSettingValues<Schema extends PluginSettingsSchema> = {
	[Key in keyof Schema]: PluginSettingValue<Schema[Key]>
}

/** Keys of boolean settings, used by `when` to toggle contributions declaratively. */
export type BooleanSettingKey<Schema extends PluginSettingsSchema> = string extends keyof Schema
	? string
	: {
			[Key in keyof Schema]: Schema[Key] extends { type: "boolean" } ? Key : never
		}[keyof Schema] &
			string

/** Context injected into every handler, view, and `activate` call. */
export interface PluginContext<
	Schema extends PluginSettingsSchema = PluginSettingsSchema,
	CommandId extends string = string,
	ViewId extends string = string,
> {
	readonly manifest: PluginManifest

	settings: {
		/** Stored value, or the schema default. */
		get<Key extends keyof Schema & string>(key: Key): PluginSettingValue<Schema[Key]>
		set<Key extends keyof Schema & string>(
			key: Key,
			value: PluginSettingValue<Schema[Key]>,
		): Promise<void>
		getAll(): PluginSettingValues<Schema>
		onChange<Key extends keyof Schema & string>(
			key: Key,
			callback: (
				value: PluginSettingValue<Schema[Key]>,
				oldValue: PluginSettingValue<Schema[Key]>,
			) => void,
		): Disposable
	}

	commands: {
		/** Execute one of this plugin's commands. Returns false when it is not registered. */
		execute(commandId: CommandId, payload?: unknown): boolean
	}

	ui: {
		/** Open one of this plugin's `location: "modal"` views. */
		openModal(viewId: ViewId, options?: ModalOpenOptions): string | null
		closeModal(instanceId: string): void
		/** Requires `notifications`. */
		showNotice(message: string): void
	}

	/** Requires `workspace:tabs`. */
	workspace: {
		openFile(path: string, options?: WorkspaceOpenOptions): void
		openView(viewId: ViewId, options?: WorkspaceOpenOptions): void
		openMarkdownTab(tab: WorkspaceMarkdownTab, options?: WorkspaceOpenOptions): void
		getOpenFiles(): string[]
		onActiveFileChange(callback: (path: string | null) => void): Disposable
	}

	/** Vault-relative file access. Read, write, delete, and watch require matching permissions. */
	vault: {
		getVaultPath(): string | null
		readFile(relativePath: string): Promise<string>
		writeFile(relativePath: string, content: string): Promise<void>
		deleteFile(relativePath: string): Promise<void>
		listFiles(dir?: string): Promise<FileEntry[]>
		exists(relativePath: string): Promise<boolean>
		onFileEvent(callback: (event: VaultFileEvent) => void): Disposable
	}

	/** Active editor access. Requires `editor:read` or `editor:write`. */
	editor: {
		getActiveFilePath(): string | null
		getActiveFileContent(): string | null
		insertAtCursor(text: string): void
		replaceSelection(text: string): void
	}

	/** Requires `vault:read`. */
	metadata: {
		getFrontmatter(path: string): Promise<Record<string, unknown> | null>
		getTags(path: string): Promise<string[]>
		getAllTags(): TagEntry[]
	}

	/** Plugin-owned files. Requires `data`. */
	data: {
		read(filename: string): Promise<string | null>
		write(filename: string, content: string): Promise<void>
		delete(filename: string): Promise<void>
		getDataPath(): string
	}

	/** Requires `theme:read`. */
	theme: {
		getActiveThemeName(): string
		onThemeChange(callback: (name: string) => void): Disposable
	}

	/** Requires `bookmarks:read` or `bookmarks:write`. */
	bookmarks: {
		list(): BookmarkEntry[]
		add(path: string): Promise<BookmarkEntry | null>
		remove(path: string): Promise<void>
		toggle(path: string, force?: boolean): Promise<BookmarkToggleResult>
		isBookmarked(path: string): boolean
		onChange(callback: (bookmarks: BookmarkEntry[]) => void): Disposable
	}

	/** Native notifications. Requires `notifications`. */
	notifications: {
		isSupported(): boolean
		getPermission(): Promise<PluginNotificationPermissionState>
		send(notification: PluginNotification): Promise<PluginNotificationResult>
	}
}

/** Command handler. `payload` carries menu targets such as `ContextMenuActionContext`. */
export type PluginCommandHandler<Context> = (context: Context, payload: unknown) => unknown

export type PluginViewState = Record<string, unknown>

export type PluginViewLocation = "tab" | "sidebar-left" | "sidebar-right" | "modal"

/** View behavior. Annotate `state` with your own object type alias for typed views. */
export interface PluginViewHandlers<Context> {
	render(state: PluginViewState, context: Context): ViewDescriptor
	reduce?(state: PluginViewState, action: string, payload: unknown): PluginViewState
	/** Side effects for dispatched actions, run after `reduce`. */
	onAction?(context: Context, action: string, payload: unknown, state: PluginViewState): unknown
}

export interface PluginCommandContribution<CommandId extends string, Context> {
	id: CommandId
	label: string
	category?: string
	aliases?: readonly string[]
	icon?: string
	/** Configurable default shortcut such as `mod+shift+e`. */
	defaultHotkey?: string
	/** Inline handler. Omit it to resolve `commands[id]` from `load()`. */
	run?: PluginCommandHandler<Context>
}

export interface PluginViewContribution<ViewId extends string, Context> {
	id: ViewId
	label: string
	icon: string
	location: PluginViewLocation
	initialState?: PluginViewState
	/** Inline renderer. Omit it to resolve `views[id]` from `load()`. */
	render?(state: PluginViewState, context: Context): ViewDescriptor
	reduce?(state: PluginViewState, action: string, payload: unknown): PluginViewState
	onAction?(context: Context, action: string, payload: unknown, state: PluginViewState): unknown
}

export interface PluginSidebarItemContribution<ViewId extends string> {
	id: string
	label: string
	icon: string
	view: ViewId
}

export interface PluginStatusBarItemContribution<
	CommandId extends string,
	BooleanKey extends string,
> {
	id: string
	position: "left" | "right"
	text?: string
	icon?: string
	tooltip?: string
	/** Command executed on click. */
	command?: CommandId
	/** Show the item only while this boolean setting is true. */
	when?: BooleanKey
}

export interface PluginContextMenuItemContribution<CommandId extends string> {
	id: string
	label: string
	icon?: string
	location: ContextMenuLocation
	/** Command executed with a `ContextMenuActionContext` payload. */
	command: CommandId
}

export interface PluginMarkdownContributions<BooleanKey extends string> {
	/** Inline replacements; `when` keeps a rule active only while a boolean setting is true. */
	inline?: readonly (MarkdownInlineRegistration & { when?: BooleanKey })[]
	semantic?: readonly MarkdownSemanticRegistration[]
	callouts?: readonly CalloutTypeRegistration[]
	preprocessors?: readonly MarkdownPreprocessorRegistration[]
	processors?: readonly MarkdownProcessorRegistration[]
}

export interface PluginContributions<
	Schema extends PluginSettingsSchema,
	CommandId extends string,
	ViewId extends string,
> {
	commands?: readonly PluginCommandContribution<
		CommandId,
		PluginContext<Schema, CommandId, ViewId>
	>[]
	views?: readonly PluginViewContribution<ViewId, PluginContext<Schema, CommandId, ViewId>>[]
	sidebarItems?: readonly PluginSidebarItemContribution<NoInfer<ViewId>>[]
	statusBarItems?: readonly PluginStatusBarItemContribution<
		NoInfer<CommandId>,
		BooleanSettingKey<Schema>
	>[]
	contextMenuItems?: readonly PluginContextMenuItemContribution<NoInfer<CommandId>>[]
	markdown?: PluginMarkdownContributions<BooleanSettingKey<Schema>>
	propertyTypes?: readonly PluginPropertyTypeRegistration[]
	foldProviders?: readonly PluginFoldProviderRegistration[]
	/** Host editor extensions (CodeMirror on desktop/mobile), created when the plugin is enabled. */
	editorExtensions?: (context: PluginContext<Schema, CommandId, ViewId>) => unknown
}

/** `activate` may return a cleanup function or Disposable, run when the plugin is disabled. */
// biome-ignore lint/suspicious/noConfusingVoidType: activate callbacks commonly return nothing
export type PluginActivationResult = void | Disposable | (() => void)

export type PluginActivate<Context> = (
	context: Context,
) => PluginActivationResult | Promise<PluginActivationResult>

/** Code resolved lazily from `load()` on the first command, view render, or startup activation. */
export interface PluginImplementation<
	Schema extends PluginSettingsSchema = PluginSettingsSchema,
	CommandId extends string = string,
	ViewId extends string = string,
> {
	activate?: PluginActivate<PluginContext<Schema, CommandId, ViewId>>
	commands?: { [Id in CommandId]?: PluginCommandHandler<PluginContext<Schema, CommandId, ViewId>> }
	views?: { [Id in ViewId]?: PluginViewHandlers<PluginContext<Schema, CommandId, ViewId>> }
}

export interface PluginDefinitionInput<
	Schema extends PluginSettingsSchema,
	CommandId extends string,
	ViewId extends string,
> {
	manifest: PluginManifest
	settings?: Schema
	/** `lazy` (default) activates on first use; `startup` activates as soon as it is enabled. */
	activation?: "lazy" | "startup"
	contributes?: PluginContributions<Schema, CommandId, ViewId>
	activate?: PluginActivate<PluginContext<Schema, CommandId, ViewId>>
	load?: () => Promise<
		| PluginImplementation<Schema, CommandId, ViewId>
		| { default: PluginImplementation<Schema, CommandId, ViewId> }
	>
}

/** Type-erased definition consumed by hosts. */
export type PluginDefinition = PluginDefinitionInput<PluginSettingsSchema, string, string>

export interface DefinedPlugin<
	Schema extends PluginSettingsSchema,
	CommandId extends string,
	ViewId extends string,
> extends PluginDefinition {
	readonly __types?: { settings: Schema; commands: CommandId; views: ViewId }
}

/** Typed context for helpers declared outside `definePlugin`: `PluginContextOf<typeof plugin>`. */
export type PluginContextOf<Plugin> =
	Plugin extends DefinedPlugin<infer Schema, infer CommandId, infer ViewId>
		? PluginContext<Schema, CommandId, ViewId>
		: never

/**
 * Declare a plugin. Hosts register the manifest and contributions without running plugin code;
 * handlers run on first use, and everything is disposed together when the plugin is disabled.
 */
export function definePlugin<
	const Schema extends PluginSettingsSchema = Record<never, never>,
	const CommandId extends string = never,
	const ViewId extends string = never,
>(
	definition: PluginDefinitionInput<Schema, CommandId, ViewId>,
): DefinedPlugin<Schema, CommandId, ViewId> {
	return definition as unknown as DefinedPlugin<Schema, CommandId, ViewId>
}
