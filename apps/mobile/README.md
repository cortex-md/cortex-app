# Cortex Mobile

Expo SDK 56 app for the Cortex native-first mobile shell.

## Commands

```bash
bun run --cwd apps/Cortex ios
bun run --cwd apps/Cortex android
bun run --cwd apps/Cortex lint
bun run --cwd apps/Cortex typecheck
```

## Phase 0 Scope

- Expo Router `NativeTabs` with nested stacks for Notes, Settings, and Search.
- `@expo/ui` settings controls for native SwiftUI / Jetpack Compose feel.
- Expo `Platform` adapter skeleton wired into `@cortex/platform`.
- DOM Component editor placeholder for the future CodeMirror WebView.

Real vault persistence, `@cortex/core`, `@cortex/editor`, search, sync, and CodeMirror plugin
loading begin in later phases.
