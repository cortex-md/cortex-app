# Lifecycle and Bundling

## Lifecycle

1. **Discover.** Cortex reads `manifest.json`, evaluates the bundle, and validates the exported
   `definePlugin` object (manifest id, known permissions).
2. **Enable.** Cortex loads plugin settings, then registers every static contribution in one batch:
   commands, views, sidebar/status bar/context menu items, the settings page, Markdown rules,
   property types, fold providers, and `editorExtensions(ctx)`. No `activate` or `load` code runs.
3. **Activate (lazy).** On the first command execution, first view render, or immediately when
   `activation: "startup"`, Cortex awaits `load()` (if declared), then `activate(ctx)` from the
   definition and from the loaded implementation.
4. **Disable.** Every registration, context subscription (`onChange`, `onFileEvent`, ...), and the
   cleanup returned by `activate` is disposed together.

```ts
export default definePlugin({
	manifest,
	activation: "startup",
	activate(ctx) {
		const timer = setInterval(() => console.log(ctx.manifest.id), 60_000)
		return () => clearInterval(timer)
	},
})
```

`activate` may return a cleanup function or a `Disposable`.

## Lazy Implementation

Keep heavy code out of the startup path by declaring metadata inline and resolving handlers from
`load()`. Commands without `run` and views without `render` are resolved from the loaded module.

```ts
// index.ts
export default definePlugin({
	manifest,
	contributes: {
		commands: [{ id: "report", label: "Build Report" }],
		views: [{ id: "report", label: "Report", icon: "chart", location: "tab" }],
	},
	load: () => import("./impl"),
})

// impl.ts
import type { PluginImplementation } from "@cortex.md/api"

export default {
	commands: { report: (ctx) => ctx.workspace.openView("report") },
	views: { report: { render: () => ({ type: "text", value: "Ready" }) } },
} satisfies PluginImplementation
```

Type the loaded module with `satisfies PluginImplementation`; deriving it from `typeof plugin` would
be circular because the definition's type depends on `load()`. `PluginContextOf<typeof plugin>` types
helper modules the definition does not import.

## Bundle Contract

The bundle default-exports the `definePlugin(...)` result. The host loads:

- CommonJS bundles through a controlled `require` stub. `require("@cortex.md/api")` provides
  `definePlugin` and `PLUGIN_PERMISSIONS`; `@codemirror/state` and `@codemirror/view` are provided
  when the bundle references them.
- ESM bundles through a generated `data:` URL import when the bundle looks like ESM. They must be
  self-contained.

For the most predictable setup, emit one CommonJS browser-targeted bundle with `@cortex.md/api`
(and any `@codemirror/*` imports) external. With CommonJS, `load: () => import("./impl")` is
bundled inline; the laziness still defers running that code until first use.

## Imports

Import only `@cortex.md/api` and your own code. Community plugins must not import Cortex internals
such as `@cortex/core`, `@cortex/editor`, or `@cortex/platform`; host APIs come through `ctx`.

## Dependency Guidance

- Bundle third-party runtime dependencies into your plugin output.
- Avoid global side effects at module top level.
- Keep plugin state serializable when it flows through views, settings, or workspace tabs.
