# Cortex

Cortex is a local-first Markdown workspace. It opens a folder you control, keeps every note as a
plain `.md` file, and adds the structure you need on top: live preview, properties, databases,
tasks, fast search, and optional end-to-end encrypted sync. Plugins and themes extend it without
changing how your notes are stored.

Website and docs: [cortex-md.tech](https://cortex-md.tech) ·
[Documentation](https://cortex-md.tech/docs) · [Roadmap](https://cortex-md.tech/roadmap) ·
[Changelog](https://cortex-md.tech/changelog)

> **Status:** pre-release. Cortex is under active development; file formats under `.cortex/`,
> APIs and UI can still change between releases. Keep backups of important vaults.

## Features

- **Plain files.** Vaults are ordinary folders of Markdown, readable in any editor. Cortex keeps its
  own state in a hidden `.cortex/` folder.
- **Live Preview editor** built on CodeMirror, with callouts, tables, tasks, code blocks, math,
  `#tags`, `==highlights==` and wikilinks, plus a Reading View.
- **Properties and databases.** Frontmatter properties with a vault schema; folders can become
  databases with table, board, calendar and gallery views.
- **Navigation.** Quick finder, command palette, full-text search, backlinks, bookmarks, tags and
  outline, built for vaults with tens of thousands of notes.
- **Tasks and reminders** with native notifications.
- **Templates, version history and comments.**
- **Cortex Sync (optional).** End-to-end encrypted sync between devices, shared vaults and members,
  hosted or self-hosted.
- **Plugins and themes** from the Marketplace, built with the public
  [`@cortex.md/api`](packages/plugin-api) and the [Cortex CLI](https://github.com/cortex-md/cli).
- **Apps:** desktop (macOS, Windows, Linux) on Electron; mobile (iOS, Android) on Expo is in
  progress.

## Download

Pre-release builds for macOS (Apple Silicon), Windows and Linux are published on the
[Releases](https://github.com/cortex-md/cortex-app/releases) page. Unsigned macOS prereleases may
need *Open Anyway* in System Settings → Privacy & Security.

## Build From Source

Requires [Bun](https://bun.sh/) 1.3.3 (and Node.js 22 for the performance harness).

```bash
git clone https://github.com/cortex-md/cortex-app.git
cd cortex-app
bun install
bun run dev:desktop      # run the desktop app in development
bun run dist:desktop     # build an installable desktop package
```

Validation used by CI:

```bash
bun run check            # Biome lint and format
bun run typecheck        # TypeScript project references
bun run check:boundaries # workspace dependency boundaries
bun run test             # Vitest suites
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for mobile and web scripts, testing policy and the pull
request workflow.

## Repository Map

```text
apps/
  desktop/          Electron app: main process, preload, React shell and features
  mobile/           Expo app (iOS, Android)
  web/              Website, docs, account and Marketplace pages
packages/
  core/             App logic: stores, vault index, note cache, indexing, sync state
  platform/         Platform interfaces (filesystem, dialogs, windows) and vault file rules
  editor/           CodeMirror runtime, Live Preview and Reading View
  renderer/         Sanitized Markdown rendering pipeline
  properties/       Frontmatter properties, schema and databases
  search/           Full-text search index and worker backend
  sync-engine/      Sync engine (runs in an Electron utility process)
  sync-api/         Sync server API client
  plugin-api/       Public plugin API, published as @cortex.md/api (MIT)
  plugin-host-core/ Plugin host, permissions and contributions
  marketplace/      Plugin and theme install, update and config sync
  theme/            Theme tokens and community theme contract
  ui/               Shared React primitives
  ...               commands, settings, tasks, comments, collab, import-export
plugins/            Bundled plugins
tools/              Benchmarks and development tooling
docs/               Contributor and community documentation
```

Every app and package has an `AGENTS.md` with its ownership, rules and validation. It is the
guidance for human contributors and coding agents alike.

## Plugins And Themes

- [Plugin docs](https://cortex-md.tech/docs/plugins/overview) and
  [theme docs](https://cortex-md.tech/docs/themes/overview)
- [Registry](https://github.com/cortex-md/registry): how extensions are listed and reviewed
- [CLI](https://github.com/cortex-md/cli): scaffold, develop, check and release extensions

## Contributing

Issues, docs fixes, design feedback and pull requests are welcome. Read
[CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). For help, see
[SUPPORT.md](SUPPORT.md); for vulnerabilities, [SECURITY.md](SECURITY.md).

## License

Cortex is licensed under the [GNU Affero General Public License v3.0 or later](LICENSE).

The plugin API package [`@cortex.md/api`](packages/plugin-api) is licensed under the
[MIT License](packages/plugin-api/LICENSE), so community plugins and themes can use any license.
