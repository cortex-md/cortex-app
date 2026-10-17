# @cortex.md/api

Public TypeScript API for Cortex plugins.

This package is the stable, dependency-free contract plugin authors import: no React, DOM,
CodeMirror, Tauri, Node.js, or Cortex internal imports. A plugin is one declarative
`definePlugin({...})` object; the Cortex host registers it, runs your code lazily, and injects a
typed context into every handler.

## Install

```bash
npm install @cortex.md/api
# or
bun add @cortex.md/api
```

## Quick Start

```ts
import { definePlugin } from "@cortex.md/api"

export default definePlugin({
	manifest: {
		id: "greeting",
		name: "Greeting",
		version: "0.1.0",
		minAppVersion: "0.1.0",
		author: "Your Name",
		description: "Inserts a greeting.",
		icon: "sparkles",
		permissions: ["editor:write"],
	},
	settings: {
		greeting: { type: "text", label: "Greeting", default: "Hello from Cortex" },
	},
	contributes: {
		commands: [
			{
				id: "insert-greeting",
				label: "Insert Greeting",
				icon: "sparkles",
				defaultHotkey: "mod+shift+g",
				run: (ctx) => ctx.editor.insertAtCursor(ctx.settings.get("greeting")),
			},
		],
	},
})
```

## Definition

```ts
definePlugin({
	manifest,      // identity + runtime permissions
	settings,      // schema record; Cortex renders the settings page and applies defaults
	contributes: {
		commands,          // palette, configurable hotkeys, Vim names
		views,             // declarative views: tab, sidebar-left, sidebar-right, modal
		sidebarItems,      // { id, label, icon, view }
		statusBarItems,    // { id, position, text?, icon?, tooltip?, command?, when? }
		contextMenuItems,  // { id, label, icon?, location, command }
		markdown,          // { inline, semantic, callouts, preprocessors, processors }
		propertyTypes,     // custom note property types
		foldProviders,     // portable line-based folding
		editorExtensions,  // (ctx) => host editor extensions
	},
	activation,    // "lazy" (default) | "startup"
	activate,      // (ctx) => void | cleanup function | Disposable
	load,          // () => import("./impl") for lazily loaded handlers and views
})
```

## Lifecycle

- **Enable:** the host registers every contribution in one batch without running plugin code.
- **Activate:** `load()` and `activate(ctx)` run on the first command execution, the first render of
  a lazy view, or immediately when `activation: "startup"`.
- **Disable:** all contributions, context subscriptions, and the cleanup returned by `activate` are
  disposed together.

Commands without `run` resolve `commands[id]` from the loaded module; views without `render`
resolve `views[id]`. Type that module with `satisfies PluginImplementation`.

## Typed Context

`ctx` is inferred from the definition:

- `ctx.settings.get/set/onChange/getAll` accept only declared keys and return schema-typed values
  (selects become their option unions). `get` returns the stored value or the default.
- `ctx.commands.execute(id)`, `ctx.workspace.openView(id)`, and `ctx.ui.openModal(id)` accept only
  declared command/view ids.
- Status bar and context menu `command`, sidebar `view`, and `when` (boolean setting keys) are
  checked the same way.

`PluginContextOf<typeof plugin>` types helper modules outside the definition. Type the module that
`load()` imports with `satisfies PluginImplementation` (deriving it from the definition is circular).

## Permissions

Contributions need no permission. Runtime APIs on `ctx` require entries in
`manifest.permissions` (see `PLUGIN_PERMISSIONS`): `vault:read`, `vault:write`, `vault:delete`,
`vault:watch`, `editor:read`, `editor:write`, `workspace:tabs`, `theme:read`, `bookmarks:read`,
`bookmarks:write`, `data`, `notifications`. Missing permissions fail closed; unknown permissions
fail the load.

## Views

```ts
views: [
	{
		id: "counter",
		label: "Counter",
		icon: "plus",
		location: "sidebar-left",
		initialState: { count: 0 },
		render: (state: { count: number }) => ({
			type: "button",
			label: `Count: ${state.count}`,
			action: "increment",
		}),
		reduce: (state: { count: number }, action) =>
			action === "increment" ? { count: state.count + 1 } : state,
		onAction(ctx, action, _payload, state) {
			if (action === "increment") ctx.editor.insertAtCursor(String(state.count))
		},
	},
]
```

`render(state, ctx)` returns portable `ViewDescriptor` nodes, `reduce` updates host-owned state,
and `onAction(ctx, action, payload, state)` performs side effects. Each view renders inside an
error boundary.

## Markdown

`markdown.inline` and `markdown.semantic` apply to Live Preview, Reading View, and export.
`markdown.preprocessors` and `markdown.processors` run only on `reading-view` and `export`.
Inline rules accept `when: "<booleanSetting>"` to toggle with a setting.

## Community Bundles

```text
<vault>/.cortex/plugins/<plugin-id>/
  manifest.json   # { "id": "<plugin-id>", "main": "dist/index.js" }
  dist/index.js   # default export: definePlugin({...})
  styles.css      # optional; requires contributes.markdown; scoped to .markdown-surface
```

Emit one browser-targeted CommonJS bundle with `@cortex.md/api` external; the host's `require`
provides `definePlugin`, plus `@codemirror/state` and `@codemirror/view` when the bundle imports
them. Self-contained ESM bundles are also accepted.

This package includes a minimal `globals.d.ts` (`console`, timers, a narrow `fetch`). It adds no DOM
or Node.js types; bundle any third-party runtime dependencies.

## Publishing Checklist

1. Import only from `@cortex.md/api` and your own bundled code.
2. Keep the bundle's `manifest.id` equal to `manifest.json`.
3. Request only the runtime permissions your handlers call.
4. Keep vault paths relative with forward slashes.
5. Use declarative views instead of React or DOM APIs.
6. Return a cleanup from `activate` for timers or external resources.

## License

MIT. See [LICENSE](LICENSE). The Cortex app itself is licensed under AGPL-3.0-or-later; plugins
built on this package may use any license.
