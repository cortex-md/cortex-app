# Commands and Hotkeys

Plugin commands enter the same command registry used by Cortex's command palette, configurable
hotkeys, menus, and Vim command-line choices.

## Register a Command

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

Declare `commands` in `manifest.json`.

## Command Ids

Public command ids are local to the plugin. Cortex prefixes them internally before they enter the
global command registry, so `open-dashboard` can safely exist in more than one plugin.

Use stable command ids because users may assign custom hotkeys to them.

## Hotkeys

Use `defaultHotkey` for the suggested shortcut:

```ts
defaultHotkey: "mod+shift+d"
```

The user can reassign or disable the binding in Cortex. Do not implement a second hotkey system in
your plugin.

## Vim Names

Cortex derives Vim command-line choices from the same command registry. Keep labels and ids clear
because Vim names are generated from the command id and shown to users in command hints.

## Execution Guidelines

- Keep command handlers small and responsive.
- For longer work, show progress through a view, status bar item, notification, or generated
  Markdown tab.
- Use `api.commands.execute(id)` only for commands your plugin owns or intentionally composes with.

