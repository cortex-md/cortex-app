# Getting Started With Plugins

This guide creates a small plugin with one command that inserts text into the active editor.

## Minimal Folder

```text
hello-cortex/
  manifest.json
  package.json
  src/index.ts
```

## manifest.json

The loader only needs the id and bundle path. Everything else lives in the bundle.

```json
{
	"id": "hello-cortex",
	"main": "dist/index.js"
}
```

`main` must be a safe relative path inside the plugin directory. Absolute paths, drive-letter paths,
empty paths, and paths containing `..` are rejected. Marketplace releases may add display fields
(`name`, `version`, `minAppVersion`, ...) for catalog pages.

## Package

```json
{
	"name": "hello-cortex",
	"version": "0.1.0",
	"type": "module",
	"scripts": {
		"build": "bun build ./src/index.ts --outfile ./dist/index.js --target browser --format cjs --external @cortex.md/api"
	},
	"dependencies": {
		"@cortex.md/api": "^0.1.0"
	},
	"devDependencies": {
		"typescript": "~5.8.3"
	}
}
```

## Plugin Entry

```ts
import { definePlugin } from "@cortex.md/api"

export default definePlugin({
	manifest: {
		id: "hello-cortex",
		name: "Hello Cortex",
		version: "0.1.0",
		minAppVersion: "0.1.0",
		author: "Your Name",
		description: "Adds a sample command.",
		icon: "sparkles",
		permissions: ["editor:write"],
	},
	contributes: {
		commands: [
			{
				id: "insert-hello",
				label: "Insert Hello",
				icon: "sparkles",
				defaultHotkey: "mod+shift+h",
				run: (ctx) => ctx.editor.insertAtCursor("Hello from Cortex"),
			},
		],
	},
})
```

The bundle's `manifest.id` must match `manifest.json`. The command appears in the palette, hotkey
settings, and Vim command line as soon as the plugin is enabled; `run` executes only when invoked.

## Build and Link

After `bun run build`, copy or symlink the plugin into the active vault:

```text
<vault>/.cortex/plugins/hello-cortex/
  manifest.json
  dist/index.js
```

Enable it in Settings > Plugins. Editing files inside the folder triggers a hot reload.
