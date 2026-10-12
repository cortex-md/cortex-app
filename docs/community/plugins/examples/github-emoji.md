# Example: GitHub Emoji Plugin

The bundled GitHub emoji plugin shows the whole declarative API in one logic file plus one data
file:

- `plugins/github-emoji/index.ts`
- `plugins/github-emoji/emojiMap.ts`

Bundled plugins are listed once in `plugins/index.ts`; desktop and mobile both load that list, so
adding a bundled plugin needs no other config edits.

## What It Demonstrates

- `definePlugin` with the manifest inside the plugin and runtime `permissions`
  (`editor:write`, `workspace:tabs`).
- A settings schema (`livePreview`, `showInStatusBar`) whose defaults apply automatically.
- A Markdown inline rule gated by `when: "livePreview"`.
- Commands with a default hotkey and inline `run(ctx)` handlers.
- A sidebar view with typed state, a pure `reduce`, and `onAction` that inserts the chosen emoji
  into the active editor.
- A status bar item that runs a command and is shown only while `showInStatusBar` is on.

## Shape

```ts
export default definePlugin({
	manifest: {
		id: "github-emoji",
		name: "GitHub Emoji",
		version: "0.1.0",
		minAppVersion: "0.1.0",
		author: "Cortex",
		description: "Convert :emoji_code: to emoji characters in the editor",
		icon: "smile",
		permissions: ["editor:write", "workspace:tabs"],
	},
	settings: {
		livePreview: { type: "boolean", label: "Replace emoji codes", default: true },
		showInStatusBar: { type: "boolean", label: "Status bar indicator", default: true },
	},
	contributes: {
		markdown: {
			inline: [
				{
					id: "github-emoji",
					pattern: ":([a-z0-9_+-]+):",
					flags: "gi",
					when: "livePreview",
					replacement: {
						type: "text",
						content: (match) => GITHUB_EMOJI_MAP[match[1].toLowerCase()] ?? match[0],
					},
				},
			],
		},
		commands: [
			{
				id: "open-browser",
				label: "Open Emoji Browser",
				defaultHotkey: "mod+shift+e",
				run: (ctx) => ctx.workspace.openView("emoji-browser", { target: "right" }),
			},
		],
		views: [
			{
				id: "emoji-browser",
				label: "Emoji Browser",
				icon: "smile",
				location: "sidebar-left",
				initialState: { searchQuery: "", activeCategory: "Smileys", recentEmojis: [] },
				render: (state: EmojiBrowserState) => renderEmojiBrowser(state),
				reduce: reduceEmojiBrowser,
				onAction(ctx, action, payload) {
					if (action === "insert") ctx.editor.insertAtCursor(GITHUB_EMOJI_MAP[String(payload)])
				},
			},
		],
		sidebarItems: [{ id: "emoji-browser", label: "Emoji", icon: "smile", view: "emoji-browser" }],
		statusBarItems: [
			{
				id: "emoji-status",
				position: "right",
				icon: "smile",
				text: `${EMOJI_COUNT} emojis`,
				command: "open-browser",
				when: "showInStatusBar",
			},
		],
	},
})
```

Command ids (`"open-browser"`), view ids (`"emoji-browser"`), and boolean setting keys
(`"livePreview"`, `"showInStatusBar"`) are inferred, so typos fail type-checking.

## Community Version

A community version uses the same `definePlugin` object as the bundle's default export, plus a
`manifest.json` with `{ "id": "github-emoji", "main": "dist/index.js" }`. A `styles.css` would be
allowed because the plugin declares `contributes.markdown`.
