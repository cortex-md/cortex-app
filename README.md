# Cortex

Cortex is a local-first, modular Markdown workspace. The project is building a fast desktop app for
notes, vaults, sync, themes, and community extensions, with shared packages that keep the core app
logic portable over time.

The repository is currently desktop-first. Mobile and web packages exist in the monorepo, but the
default development and CI gates focus on the Electron desktop app and the shared packages it uses.

## Project Goals

- Make Markdown vaults feel fast, native, and durable on desktop.
- Keep file ownership local-first and transparent.
- Provide a stable plugin and theme surface for community extensions.
- Preserve clear package boundaries so desktop, future mobile, and developer tooling can share the
  same core contracts without leaking platform details.

## Contributions Welcome

Issues, bug reports, design feedback, docs improvements, and pull requests are welcome. If you want
to work on a larger feature or architectural change, please open an issue first so we can align on
scope before you spend a lot of time on it.

Start with [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow, pull request checklist,
and local validation commands.

## Repository Map

```text
apps/
  desktop/          Electron desktop app: main process, preload, React shell and features
  mobile/           Expo mobile app, currently outside the default CI gate
  web/              Public web app, validated through explicit web scripts
packages/
  core/             Pure app logic, stores, NoteCache, vault state, sync state
  platform/         Cross-platform interfaces for filesystem, dialogs, windows, services
  sync-engine/      Sync engine (utilityProcess) and the shared server API client
  editor/           CodeMirror editor runtime and Markdown editing behavior
  ui/               Shared React primitives
  plugin-api/       Public API package for community plugins
  plugin-host-*/    Declarative plugin host, permissions, and React rendering of contributions
  renderer/         Sanitized Markdown rendering pipeline
  theme/            Desktop/web theme tokens and community theme manifests
  marketplace/      Extension install, update, staging, and rollback logic
docs/               Public docs for development, modules, plugins, themes, and mobile roadmap
plugins/            Bundled community-style plugins
tools/              Benchmarks and development tooling
```

## Prerequisites

- [Bun](https://bun.sh/) 1.3.3, matching the repository `packageManager`.

Electron downloads its own runtime during `bun install`; no native toolchain is required for
development.

## Run The Desktop App

From the repository root:

```bash
bun install
bun run dev:desktop
```

Useful desktop commands:

```bash
bun run check              # Desktop Biome lint, format, and import checks
bun run typecheck          # Desktop TypeScript project references
bun run check:boundaries   # Workspace dependency boundaries
bun run test               # Desktop frontend suites plus sync-engine tests
bun run doctor             # React Doctor on apps/desktop changed scope
```

Mobile and web checks are still available explicitly:

```bash
bun run check:mobile
bun run check:web
bun run test:mobile
bun run test:web
bun run typecheck:all
```

## Documentation

- [Development docs](docs/development/README.md): desktop setup, quality gates, architecture, and
  development practices.
- [Module map](docs/modules/README.md): package boundaries and community-facing contracts.
- [Community plugin docs](docs/community/plugins/README.md): plugin authoring with
  `@cortex.md/api`.
- [Community theme docs](docs/community/themes/README.md): vault-scoped CSS themes.
- [Mobile roadmap](docs/mobile/roadmap.md): current mobile direction.

## Current Status

Cortex is under active development. Expect APIs, UI, and workflows to evolve as the desktop app
stabilizes. The best contributions right now are focused, well-tested fixes and small improvements
that keep desktop behavior reliable.
