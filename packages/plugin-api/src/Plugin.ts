import type {
	CalloutTypeRegistration,
	ContextMenuItemRegistration,
	Disposable,
	MarkdownInlineRegistration,
	MarkdownPreprocessorRegistration,
	MarkdownProcessorRegistration,
	MarkdownSemanticRegistration,
	ModalOpenOptions,
	PluginAPI,
	PluginCommand,
	PluginFoldProviderRegistration,
	PluginManifest,
	PluginNotification,
	PluginNotificationResult,
	PluginPropertyTypeRegistration,
	SettingsTabRegistration,
	SidebarItemRegistration,
	StatusBarItemRegistration,
	ViewRegistration,
	WorkspaceMarkdownTab,
	WorkspaceOpenOptions,
} from "./types"

/**
 * Base class for every Cortex community plugin.
 *
 * The host creates one instance, injects `manifest` and `api`, then calls `onload()`.
 * Prefer the helper methods on this class for registrations because they are tracked and disposed
 * automatically when the plugin is unloaded.
 */
export abstract class CortexPlugin {
	/** Manifest loaded from the plugin's `manifest.json`. Injected by the Cortex host. */
	manifest!: PluginManifest

	/** Capability-guarded host API for vault, editor, UI, workspace, data, and other services. */
	api!: PluginAPI

	private _disposables: Set<Disposable> = new Set()

	/** Called when the plugin is enabled. Register commands, views, listeners, and extensions here. */
	abstract onload(): void | Promise<void>

	/** Called before the host disposes tracked registrations. Override for custom cleanup only. */
	onunload(): void | Promise<void> {}

	/** Register a command and track its disposable for plugin unload. Requires the `commands` capability. */
	addCommand(command: PluginCommand): Disposable {
		const disposable = this.api.commands.register(command)
		this._disposables.add(disposable)
		return disposable
	}

	/**
	 * Register a host-specific editor extension.
	 *
	 * Requires `editor:extensions`. Extension values are intentionally typed as `unknown` so this
	 * package stays free of CodeMirror and browser dependencies.
	 */
	registerEditorExtension(extension: unknown): Disposable {
		const disposable = this.api.editor.registerExtension(extension)
		this._disposables.add(disposable)
		return disposable
	}

	/** Register a portable editor fold provider. Requires `editor:folding`. */
	registerFoldProvider(provider: PluginFoldProviderRegistration): Disposable {
		const disposable = this.api.editor.registerFoldProvider(provider)
		this._disposables.add(disposable)
		return disposable
	}

	/** Register a lightweight regex markdown replacement. Requires `markdown:extensions`. */
	registerMarkdownInline(registration: MarkdownInlineRegistration): Disposable {
		const disposable = this.api.markdown.registerInline(registration)
		this._disposables.add(disposable)
		return disposable
	}

	/** Register a portable markdown semantic transform. Requires `markdown:extensions`. */
	registerMarkdownSemantic(registration: MarkdownSemanticRegistration): Disposable {
		const disposable = this.api.markdown.registerSemantic(registration)
		this._disposables.add(disposable)
		return disposable
	}

	/** Register or override a callout type used by markdown surfaces. Requires `markdown:extensions`. */
	registerCalloutType(registration: CalloutTypeRegistration): Disposable {
		const disposable = this.api.markdown.registerCalloutType(registration)
		this._disposables.add(disposable)
		return disposable
	}

	/** Register a markdown string preprocessor for reading/export surfaces. Requires `markdown:extensions`. */
	registerMarkdownPreprocessor(preprocessor: MarkdownPreprocessorRegistration): Disposable {
		const disposable = this.api.markdown.registerPreprocessor(preprocessor)
		this._disposables.add(disposable)
		return disposable
	}

	/**
	 * Register an advanced Unified processor for reading/export surfaces.
	 *
	 * Live Preview integrations should use `registerMarkdownInline`,
	 * `registerMarkdownSemantic`, or editor extensions instead.
	 */
	registerMarkdownProcessor(processor: MarkdownProcessorRegistration): Disposable {
		const disposable = this.api.markdown.registerProcessor(processor)
		this._disposables.add(disposable)
		return disposable
	}

	/** Register a custom note property type. Requires `properties:types`. */
	registerPropertyType(registration: PluginPropertyTypeRegistration): Disposable {
		const disposable = this.api.properties.registerType(registration)
		this._disposables.add(disposable)
		return disposable
	}

	/** Register a declarative host-rendered view. Requires `ui:views`. */
	registerView(registration: ViewRegistration): Disposable {
		const disposable = this.api.ui.registerView(registration)
		this._disposables.add(disposable)
		return disposable
	}

	/** Add a sidebar entry that opens a registered view. Requires `ui:sidebar`. */
	registerSidebarItem(item: SidebarItemRegistration): Disposable {
		const disposable = this.api.ui.registerSidebarItem(item)
		this._disposables.add(disposable)
		return disposable
	}

	/** Add a status bar item. Requires `ui:statusbar`. */
	registerStatusBarItem(item: StatusBarItemRegistration): Disposable {
		const disposable = this.api.ui.registerStatusBarItem(item)
		this._disposables.add(disposable)
		return disposable
	}

	/**
	 * Register a settings tab and automatically subscribe each setting's `onChange` callback.
	 *
	 * Requires `settings`. Disposing the returned value removes both the tab and every generated
	 * settings listener.
	 */
	registerSettingsTab(tab: SettingsTabRegistration): Disposable {
		const disposables: Disposable[] = [this.api.ui.registerSettingsTab(tab)]

		for (const definition of tab.settings) {
			if (definition.onChange) {
				const onChangeDisposable = this.api.settings.onChange(definition.key, definition.onChange)
				disposables.push(onChangeDisposable)
			}
		}

		let disposed = false
		const compositeDisposable: Disposable = {
			dispose: () => {
				if (disposed) return
				disposed = true
				for (const disposable of disposables) disposable.dispose()
				this._disposables.delete(compositeDisposable)
			},
		}
		this._disposables.add(compositeDisposable)
		return compositeDisposable
	}

	/** Register a context menu item for files, editor selections, or tabs. Requires `ui:contextmenu`. */
	registerContextMenuItem(item: ContextMenuItemRegistration): Disposable {
		const disposable = this.api.ui.registerContextMenuItem(item)
		this._disposables.add(disposable)
		return disposable
	}

	/** Send a native host notification. Requires `notifications`. */
	notify(notification: PluginNotification): Promise<PluginNotificationResult> {
		return this.api.notifications.send(notification)
	}

	/** Open a registered `location: "modal"` view. Requires `ui:modals`. */
	openModal(viewId: string, options?: ModalOpenOptions): string | null {
		return this.api.ui.openModal(viewId, options)
	}

	/** Close a modal instance returned by `openModal`. Requires `ui:modals`. */
	closeModal(instanceId: string): void {
		this.api.ui.closeModal(instanceId)
	}

	/** Open temporary read-only markdown content in the workspace. Requires `workspace:tabs`. */
	openMarkdownTab(tab: WorkspaceMarkdownTab, options?: WorkspaceOpenOptions): void {
		this.api.workspace.openMarkdownTab(tab, options)
	}

	/** @internal Host-owned cleanup hook. Plugin authors should not call this method. */
	_disposeAll(): void {
		try {
			for (const disposable of this._disposables) {
				try {
					disposable.dispose()
				} catch (error) {
					console.error("[Plugin disposal failed]", {
						pluginId: this.manifest.id,
						error,
					})
				}
			}
		} finally {
			this._disposables.clear()
		}
	}
}
