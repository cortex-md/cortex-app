# Getting Started With Plugins

This guide creates a small command plugin that inserts text into the active editor.

## Minimal Folder

```text
hello-cortex/
  manifest.json
  package.json
  src/index.ts
```

## Manifest

```json
{
	"id": "hello-cortex",
	"name": "Hello Cortex",
	"version": "0.1.0",
	"minAppVersion": "0.1.0",
	"author": "Your Name",
	"description": "Adds a sample command.",
	"icon": "sparkles",
	"main": "dist/index.js",
	"capabilities": ["commands", "editor:write"]
}
```

`main` must be a safe relative path inside the plugin directory. Absolute paths, drive-letter paths,
empty paths, and paths containing `..` are rejected.

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

The desktop host can load CommonJS bundles through a host-provided `@cortex.md/api` external. ESM
bundles are also supported when the final bundle is self-contained and exports a default plugin
class.

## Plugin Entry

```ts
import { CortexPlugin } from "@cortex.md/api"

export default class HelloCortexPlugin extends CortexPlugin {
	onload(): void {
		this.addCommand({
			id: "insert-hello",
			label: "Insert Hello",
			icon: "sparkles",
			defaultHotkey: "mod+shift+h",
			execute: () => {
				this.api.editor.insertAtCursor("Hello from Cortex")
			},
		})
	}
}
```

## Build Output

After `bun run build`, copy or symlink the plugin into the active vault:

```text
<vault>/.cortex/plugins/hello-cortex/
  manifest.json
  dist/index.js
```

Keep `manifest.json` at the plugin root. Keep the built file at the path declared by `main`.

## Manual Development Link

Until official CLI docs are added, the manual development workflow is:

```bash
mkdir -p "<vault>/.cortex/plugins"
ln -s "/absolute/path/to/hello-cortex" "<vault>/.cortex/plugins/hello-cortex"
```

Restart Cortex or edit a plugin file to trigger the plugin watcher. The plugin list should show the
manifest name and icon if the bundle loads successfully.

