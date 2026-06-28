# @cortex.md/api

Public TypeScript API for Cortex community plugins.

This package contains the stable contract that plugin authors import from their plugin bundle. It is
intentionally small and dependency-free: no React, DOM, CodeMirror, Tauri, Node.js, or Cortex
internal package imports are exposed here. The Cortex host provides runtime behavior through the
injected `PluginAPI` object.

## Install

```bash
npm install @cortex.md/api
```

With Bun:

```bash
bun add @cortex.md/api
```

For the first public release of this package, use `^0.1.0` in plugin templates:

```json
{
	"dependencies": {
		"@cortex.md/api": "^0.1.0"
	}
}
```

## Quick Start

```ts
import { CortexPlugin } from "@cortex.md/api"

export default class ExamplePlugin extends CortexPlugin {
	onload(): void {
		this.addCommand({
			id: "insert-greeting",
			label: "Insert Greeting",
			icon: "sparkles",
			defaultHotkey: "mod+shift+g",
			execute: () => {
				this.api.editor.insertAtCursor("Hello from Cortex")
			},
		})
	}
}
```

The host constructs the class, injects `this.manifest` and `this.api`, then calls `onload()`.
Registrations created through helper methods such as `addCommand()` and `registerView()` are
automatically disposed when the plugin unloads.

## Manifest

Every plugin ships a `manifest.json`. The API package exports `PluginManifest` for the same shape.

```json
{
	"id": "example-plugin",
	"name": "Example Plugin",
	"version": "0.1.0",
	"minAppVersion": "0.1.0",
	"author": "Your Name",
	"description": "Adds a sample command and sidebar view.",
	"icon": "puzzle",
	"main": "dist/index.js",
	"capabilities": ["commands", "editor:write", "ui:views", "ui:sidebar"]
}
```

Use stable ids. Command ids, view ids, settings keys, and data filenames are local to your plugin,
but they should still be descriptive because users may see them in logs or diagnostics.

## Capabilities

Capabilities are declared in `manifest.json`. The host checks them at API boundaries and fails
closed when a plugin calls an API it did not request.

| Capability | Enables |
| --- | --- |
| `commands` | `api.commands.register`, command palette, default hotkeys, Vim command names |
| `editor:read` | Active file path and active editor content reads |
| `editor:write` | Insert text and replace editor selections |
| `editor:extensions` | Host-specific editor extensions |
| `editor:folding` | Portable editor fold providers |
| `vault:read` | Vault path, file reads, exists checks, directory listings |
| `vault:write` | Writing files in the vault |
| `vault:delete` | Deleting files in the vault |
| `vault:watch` | Vault file event subscriptions |
| `markdown:extensions` | Markdown inline, semantic, callout, preprocessor, and processor registration |
| `ui:views` | Declarative plugin views |
| `ui:sidebar` | Sidebar items that open registered views |
| `ui:statusbar` | Status bar items |
| `ui:contextmenu` | File, editor, and tab context menu items |
| `ui:modals` | Opening and closing registered modal views |
| `workspace:tabs` | Opening files, views, and temporary markdown tabs in the workspace |
| `settings` | Settings schema, values, settings tab registration, and change listeners |
| `theme:read` | Active theme name and theme change subscriptions |
| `bookmarks:read` | Bookmark list, lookup, and bookmark change subscriptions |
| `bookmarks:write` | Add, remove, and toggle bookmarks |
| `properties:types` | Custom note property types |
| `data` | Plugin-owned persistent files |
| `notifications` | Native notifications and lightweight notices |

Request only the capabilities you need. Cortex may show these capabilities to users during install
or review flows.

## Lifecycle and Cleanup

Implement `onload()` for startup work and optionally `onunload()` for custom cleanup:

```ts
import { CortexPlugin, type Disposable } from "@cortex.md/api"

export default class WatchPlugin extends CortexPlugin {
	private watcher?: Disposable

	onload(): void {
		this.watcher = this.api.vault.onFileEvent((event) => {
			console.log("Vault changed", event.path)
		})
	}

	onunload(): void {
		this.watcher?.dispose()
	}
}
```

If you use helper methods on `CortexPlugin`, the host tracks their disposables for you. Keep manual
cleanup for resources the helper methods do not know about, such as timers or plugin-owned caches.

## Commands

Commands are plugin-local actions that Cortex can surface in the command palette, hotkeys, menus,
or Vim command mode.

```ts
this.addCommand({
	id: "open-dashboard",
	label: "Open Dashboard",
	category: "Dashboard",
	aliases: ["stats", "overview"],
	icon: "layout-dashboard",
	defaultHotkey: "mod+shift+d",
	execute: () => {
		this.api.workspace.openView("dashboard")
	},
})
```

Use `defaultHotkey` for the suggested shortcut. The user can reconfigure it in Cortex.

## Editor Folding

Plugins can add foldable regions without importing CodeMirror by registering a portable provider:

```ts
this.registerFoldProvider({
	id: "spoiler-blocks",
	label: "Spoiler blocks",
	getFoldRange: (context) => {
		if (context.lineText !== ":::spoiler") return null
		for (let line = context.lineNumber + 1; line <= context.lineCount; line += 1) {
			if (context.getLine(line) === ":::") {
				return { toLine: line, placeholder: "spoiler" }
			}
		}
		return null
	},
})
```

Declare `editor:folding` in the manifest. Fold providers may add fold ranges only; users can still
disable folding globally in Cortex editor settings.

## Settings

Settings are stored by the host and rendered through Cortex settings UI.

```ts
this.registerSettingsTab({
	id: "example",
	label: "Example",
	icon: "settings",
	settings: [
		{
			key: "enabled",
			label: "Enabled",
			type: "boolean",
			default: true,
			onChange: (value) => {
				this.api.ui.showNotice(`Enabled: ${String(value)}`)
			},
		},
	],
})
```

`registerSettingsTab()` also subscribes any setting `onChange` callbacks and disposes them when the
tab registration is disposed.

## Vault and Data Files

Vault APIs work with vault-relative paths:

```ts
const content = await this.api.vault.readFile("notes/today.md")
await this.api.vault.writeFile("notes/today.md", `${content}\n\nUpdated by plugin.`)
```

Plugin data APIs are for plugin-owned files, not user notes:

```ts
await this.api.data.write("cache.json", JSON.stringify({ lastRun: Date.now() }))
const cached = await this.api.data.read("cache.json")
```

Use vault APIs for user-visible notes. Use data APIs for plugin state, caches, and preferences that
do not belong in the user's markdown files.

## Declarative Views

Plugins do not render React components or arbitrary DOM. They return portable `ViewDescriptor`
objects that the host renders consistently across desktop and future hosts.

```ts
import type { ViewDescriptor, ViewDispatch, ViewState } from "@cortex.md/api"

function renderCounter(state: ViewState, _dispatch: ViewDispatch): ViewDescriptor {
	const count = Number(state.state.count ?? 0)

	return {
		type: "stack",
		gap: "sm",
		children: [
			{ type: "heading", value: "Counter" },
			{ type: "text", value: `Count: ${count}` },
			{ type: "button", label: "Increment", action: "increment", variant: "primary" },
		],
	}
}

this.registerView({
	id: "counter",
	label: "Counter",
	icon: "plus",
	location: "sidebar-left",
	initialState: { count: 0 },
	reduce: (state, action) => {
		if (action === "increment") return { ...state, count: Number(state.count ?? 0) + 1 }
		return state
	},
	render: renderCounter,
})

this.registerSidebarItem({
	id: "counter",
	label: "Counter",
	icon: "plus",
	viewId: "counter",
})
```

View state is host-owned and should stay serializable. Use `action` and `payload` on view nodes to
communicate user intent back to the host reducer.

## Markdown Extensions

Use inline registrations for simple regex replacements:

```ts
this.registerMarkdownInline({
	id: "smile-shortcode",
	pattern: ":smile:",
	replacement: { type: "text", content: "smile" },
})
```

Use semantic registrations when the output should work in Live Preview, Reading View, and export:

```ts
this.registerMarkdownSemantic({
	id: "ticket-links",
	selector: { type: "text" },
	priority: 10,
	transform: ({ node }) => {
		if (node.type !== "text" || !node.value.includes("APP-")) return null
		return node
	},
})
```

Use preprocessors and Unified processors only for `reading-view` and `export`. Live Preview-specific
behavior belongs in inline registrations, semantic registrations, or editor extensions.

## Notifications

Plugins cannot request OS notification permission directly. The host owns permission prompts and
platform support.

```ts
const permission = await this.api.notifications.getPermission()

if (permission === "granted") {
	await this.notify({
		title: "Sync complete",
		body: "Your plugin task finished.",
		kind: "success",
	})
}
```

Check `PluginNotificationResult.delivered` and `reason` when delivery matters.

## Temporary Markdown Tabs

Use `openMarkdownTab()` for generated, read-only content such as changelogs, reports, or plugin
help. The host opens it in the workspace without writing it to the vault.

```ts
this.openMarkdownTab({
	title: "Example Plugin Help",
	content: "# Example Plugin\n\nThis tab was generated by the plugin.",
})
```

## Bundle Expectations

Plugin bundles should import public types and `CortexPlugin` from `@cortex.md/api` only. Do not
import Cortex internal packages such as `@cortex/core`, `@cortex/editor`, or `@cortex/platform`.

This package includes a minimal `globals.d.ts` for common runtime globals such as `console`,
timers, and a narrow `fetch` shape. It does not add DOM or Node.js types. Bundle any third-party
runtime dependencies your plugin needs.

## Publishing Checklist for Plugin Authors

1. Import only from `@cortex.md/api` and your own bundled code.
2. Declare every required capability in `manifest.json`.
3. Keep vault paths relative and never assume OS-specific separators.
4. Use declarative views instead of React or DOM APIs.
5. Dispose manual listeners, timers, and caches in `onunload()`.
6. Run the Cortex CLI validator before publishing.

```bash
cortex plugin validate
```
