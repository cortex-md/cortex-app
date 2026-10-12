# Commands and Hotkeys

Commands are declared under `contributes.commands` and feed the command palette, configurable
hotkeys, and Vim command-line names from one entry.

## Declare a Command

```ts
contributes: {
	commands: [
		{
			id: "insert-date",
			label: "Insert Date",
			category: "Daily",
			aliases: ["date"],
			icon: "calendar",
			defaultHotkey: "mod+shift+d",
			run: (ctx) => ctx.editor.insertAtCursor(new Date().toISOString().slice(0, 10)),
		},
	],
}
```

`run(ctx, payload)` receives the typed plugin context and an optional payload (menu targets).
Omit `run` to resolve `commands[id]` from `load()`. The first execution activates the plugin.

## Command Ids

Ids are plugin-local. Cortex registers them as `<plugin-id>:<command-id>`. Inside the plugin, ids
are inferred: `ctx.commands.execute("insert-date")` type-checks, unknown ids do not.

Status bar items (`command`) and context menu items (`command`) reference these ids instead of
holding callbacks.

## Hotkeys

`defaultHotkey` is the default only; users rebind it in Settings > Hotkeys and the override wins.
Plugin hotkeys are global-scoped. There is no separate hotkeys API.

## Vim Names

Vim command-line names derive from aliases, labels, and ids. Use short aliases for frequent
commands and avoid names that collide with native Vim commands.

## Execution Guidelines

- Keep `run` small; move heavy work behind `load()`.
- Rejected promises are reported by the command registry; do not swallow errors silently.
