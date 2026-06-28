# Example: GitHub Emoji Plugin

The bundled GitHub emoji plugin is the best current example of a practical Cortex plugin.

Source files:

- `plugins/github-emoji/package.json`
- `plugins/github-emoji/src/index.ts`
- `plugins/github-emoji/src/emojiMap.ts`

## What It Demonstrates

- Importing `CortexPlugin` from `@cortex.md/api`.
- Registering Markdown inline replacements.
- Adding command palette entries and default hotkeys.
- Writing to the active editor.
- Adding a status bar item.
- Registering a settings tab.
- Registering a declarative sidebar view with serializable state.

## Main Plugin Shape

```ts
import { CortexPlugin } from "@cortex.md/api"

export default class GitHubEmojiPlugin extends CortexPlugin {
	onload() {
		this.registerMarkdownInline({
			id: "github-emoji",
			pattern: ":([a-z0-9_+-]+):",
			flags: "gi",
			replacement: {
				type: "text",
				content: (match) => GITHUB_EMOJI_MAP[match[1].toLowerCase()] ?? match[0],
			},
		})
	}
}
```

## Commands

The plugin registers commands with plugin-local ids:

- `insert-emoji`
- `emoji-reference`

The `insert-emoji` command uses `editor:write` to insert text at the cursor. The command also
declares a default hotkey, so Cortex can mirror it into the user's configurable hotkeys.

## Settings

The settings tab uses host-rendered fields:

- Boolean setting for Live Preview behavior.
- Select setting for emoji size.
- Select setting for skin tone.
- Boolean setting for status bar display.

The `onChange` handler shows a notice, so the plugin needs `notifications` if it uses that behavior
in a community manifest.

## Sidebar View

The emoji browser view is declarative. It returns portable nodes such as stack, row, scroll-area,
button, heading, and text. State changes go through view actions and a reducer instead of React
state owned by the plugin.

Use this pattern for plugin UI that should work in tabs, sidebars, and modals.

