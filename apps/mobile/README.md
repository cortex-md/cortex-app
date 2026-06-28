# Cortex Mobile

Expo SDK 56 app for the Cortex native-first mobile shell.

## Commands

```bash
bun run --cwd apps/mobile ios
bun run --cwd apps/mobile android
bun run --cwd apps/mobile lint
bun run --cwd apps/mobile typecheck
bun run --cwd apps/mobile test:unit
```

## Current Foundation

- Expo Router nested stacks with a sidebar-first shell for Files, Search, and Settings.
- Real local vaults selected through the native folder picker.
- Logical mobile vault paths under `/mobile-vaults/<uuid>` mapped app-locally to provider URIs.
- `@expo/ui` settings controls for native SwiftUI / Jetpack Compose feel.
- Expo `Platform` adapter wired into `@cortex/platform`.
- DOM Component CodeMirror editor boundary.

Search, sync, marketplace, import/export, and community plugin discovery remain later phases.
