# Lifecycle and Bundling

Plugins extend `CortexPlugin` from `@cortex.md/api`.

## Lifecycle

```ts
import { CortexPlugin, type Disposable } from "@cortex.md/api"

export default class WatchPlugin extends CortexPlugin {
	private watcher?: Disposable
	private timer?: ReturnType<typeof setInterval>

	onload(): void {
		this.watcher = this.api.vault.onFileEvent((event) => {
			console.log("Vault changed", event.path)
		})

		this.timer = setInterval(() => {
			console.log("Still alive")
		}, 60_000)
	}

	onunload(): void {
		this.watcher?.dispose()
		if (this.timer) clearInterval(this.timer)
	}
}
```

Helper methods such as `addCommand`, `registerView`, `registerSettingsTab`, and
`registerMarkdownInline` track disposables automatically. Use `onunload()` for things Cortex cannot
track for you, such as timers, in-memory caches, network subscriptions, and external resources.

## Bundle Contract

The plugin bundle must export a default plugin class:

```ts
export default class MyPlugin extends CortexPlugin {
	onload(): void {}
}
```

The desktop host loads:

- CommonJS bundles through a controlled `require` stub.
- ESM bundles through a generated `data:` URL import when the bundle looks like ESM.

For the most predictable development setup, emit one CommonJS browser-targeted bundle and keep
`@cortex.md/api` external.

## Imports

Allowed:

```ts
import { CortexPlugin, type ViewDescriptor } from "@cortex.md/api"
import { helper } from "./helper"
```

Avoid:

```ts
import { useVaultStore } from "@cortex/core"
import { EditorView } from "@cortex/editor/editor-view"
import { getPlatform } from "@cortex/platform"
```

Community plugins must not import Cortex internals. Public APIs are exposed through `this.api`.

## Dependency Guidance

- Bundle third-party runtime dependencies into your plugin output.
- Keep large dependencies lazy inside your own code when the feature is rarely used.
- Avoid global side effects at module top level. Register behavior in `onload()`.
- Keep plugin state serializable when it flows through views, settings, or workspace tabs.

