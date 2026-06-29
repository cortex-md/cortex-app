# Desktop Development

The desktop app lives in `apps/desktop`. It is a Tauri app with a React/Vite frontend and a Rust
native shell.

## Run The App

From the repository root:

```bash
bun install
bun run dev:desktop
```

You can also run Tauri commands directly through the root helper:

```bash
bun run tauri dev
bun run tauri build
```

## Desktop Structure

```text
apps/desktop/
  src/                 React app shell and desktop feature composition
  src/features/        Desktop-owned features such as files, tabs, settings, sync, vault UI
  src/hooks/           Desktop React hooks
  src/utils/           Desktop-only utilities
  src/styles.css       Desktop shell, layout, command surfaces, and app-level styles
  src-tauri/           Rust commands, native window setup, filesystem, sync, protocol, keychain
  benchmarks/          App-local diagnostic workbenches
```

## Rust And IPC

Native functionality belongs in `apps/desktop/src-tauri/src`. Expose Rust commands through the Tauri
command registry, wrap them in `@cortex/ipc`, and then surface them through `@cortex/platform`.
React code should call `getPlatform()` and should not import Tauri APIs directly.

Typical flow:

```text
React desktop feature
  -> @cortex/platform interface
  -> @cortex/ipc Tauri adapter
  -> apps/desktop/src-tauri Rust command
```

## Desktop UI

- Use primitives from `@cortex/ui` when a shared primitive exists.
- Keep business logic and desktop feature state in `apps/desktop/src/features`.
- Preserve native shell behavior across macOS, Windows, and Linux.
- Keep macOS-only chrome in macOS-specific Tauri configuration or platform-scoped CSS.
- Test shell and layout changes with collapsed and expanded sidebar states.

## Desktop Validation

For a normal desktop change:

```bash
bun run check
bun run typecheck
bun run check:boundaries
bun run test
```

For Rust-only changes:

```bash
cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml --check
bun run test:rust
```

For React-facing changes:

```bash
bun run doctor
```
