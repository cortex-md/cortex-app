# Contributing To Cortex

Thanks for helping improve Cortex. Bug reports, docs fixes, design feedback, plugins, themes and
pull requests are all welcome. By taking part you agree to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Before You Start

- Search existing [issues](https://github.com/cortex-md/cortex-app/issues) and
  [discussions](https://github.com/cortex-md/cortex-app/discussions) first.
- Small fixes (typos, focused bugs, docs) can go straight to a pull request.
- For features, public APIs (`@cortex.md/api`), sync, editor behavior, file formats under
  `.cortex/`, or package boundary changes, open an issue first with the problem, the proposed
  approach, and the tradeoffs. This avoids work that cannot be merged.
- Keep pull requests focused. One problem per PR; no drive-by refactors or mass formatting.
- Security issues go through [SECURITY.md](SECURITY.md), never a public issue.

## Local Setup

Requirements:

- [Bun](https://bun.sh/) **1.3.3** (the repository `packageManager`).
- [Node.js](https://nodejs.org/) **22** for the performance harness and release scripts.
- Git with LF line endings (enforced by `.gitattributes`).
- Go, only if you work on the sibling [CLI](https://github.com/cortex-md/cli).

```bash
git clone https://github.com/cortex-md/cortex-app.git
cd cortex-app
bun install
bun run dev:desktop
```

Electron downloads its own runtime during `bun install`; no native toolchain is needed for
development. Platform notes:

- **macOS:** local unsigned builds from `bun run dist:desktop` use an ad-hoc identity. Dev mode
  (`dev:desktop`) needs nothing extra.
- **Linux:** install the usual Electron runtime libraries (`libnss3`, `libgtk-3-0`,
  `libasound2`). Headless runs need `xvfb-run`.
- **Windows:** use a recent Git for Windows and keep `core.autocrlf=false`.

Mobile (`apps/mobile`, Expo) and web (`apps/web`, TanStack Start) have their own scripts:
`bun run dev:mobile`, `bun run dev:web`. See [`apps/web/README.md`](apps/web/README.md) and
[`apps/mobile/README.md`](apps/mobile/README.md).

## Repository Map

See the map in the [README](README.md#repository-map). Each app and package has an `AGENTS.md`
describing what it owns, its rules, and its validation. Read the nearest one before changing code
in that area.

## Validation

Run the gate for every area you touched before opening a pull request. CI runs the same commands.

| Area | Commands |
| --- | --- |
| Desktop and shared packages | `bun run check`, `bun run typecheck`, `bun run check:boundaries`, `bun run test` |
| React-facing desktop changes | `bun run doctor` |
| Mobile | `bun run check:mobile`, `bun run typecheck:mobile`, `bun run test:mobile` |
| Web | `bun run check:web`, `bun run typecheck:web`, `bun run test:web` |
| Performance-sensitive changes | `bun run build` then `bun run perf -- --scale smoke --launches 1` |

`bun run check:fix` applies Biome formatting and safe fixes.

### Testing Policy

Add or update tests for **critical logic only**: sync, plugin and theme loading, file formats and
data integrity (indexes, migrations, vault files), and security-relevant code. We do not add
per-component UI tests. A test should protect behavior that would silently lose or corrupt data, or
break a public contract, if it regressed.

### Performance

Cortex targets large vaults (50k notes). Measure with `bun run perf` and the benchmarks in
[`tools/benchmarks`](tools/benchmarks/README.md) before and after a performance change, and include
the numbers in the PR. Changes without a measured gain are not merged as optimizations.

## Commits And Pull Requests

- Commit subjects follow [Conventional Commits](https://www.conventionalcommits.org/):
  `feat(sync): ...`, `fix(editor): ...`, `docs: ...`, `chore(deps): ...`. Use English.
- Branch names are short and in English (`fix/quick-finder-create-row`).
- Fill in the pull request template: summary, validation, screenshots for UI (Paper and Ink themes),
  docs updated.
- Update docs in the same PR when you change behavior, commands, settings, or a public contract:
  the package `AGENTS.md`, [`docs/`](docs/README.md), and the website docs under
  `apps/web/src/content/docs` for user-facing changes.
- Maintainers squash-merge. Expect review comments about scope, package ownership, or tests; that is
  normal.

## Working With Coding Agents

Many contributors use coding agents (Claude Code, Codex, Cursor, Copilot, Gemini and others). They
are welcome, with a few rules:

- [`AGENTS.md`](AGENTS.md) at the root and in each app/package is the single source of project
  guidance. `CLAUDE.md` files only import it; do not add tool-specific copies of the rules.
- You are the author. Review every line an agent wrote, run the validation above yourself, and be
  ready to explain the change in review. Unreviewed, unvalidated agent output will be closed.
- Do not commit agent state, plans, transcripts or caches (`.claude/`, `.codex/`, `.cursor/`,
  `.agents/`, `plans/`, local memory files). `.gitignore` covers the common ones; check
  `git status` before committing.
- Keep `AGENTS.md` files short and factual: rules, ownership, and validation. Do not paste session
  notes or long histories into them.

## Plugins And Themes

Community plugins and themes live in their own repositories and are listed through the
[registry](https://github.com/cortex-md/registry). Start with the
[plugin docs](https://cortex-md.tech/docs/plugins/overview) and
[theme docs](https://cortex-md.tech/docs/themes/overview), and the
[CLI](https://github.com/cortex-md/cli) (`cortex create`, `cortex dev`, `cortex check`).

## License

Cortex is licensed under the [GNU Affero General Public License v3.0 or later](LICENSE). By
submitting a contribution you agree that it is licensed under the same terms (inbound = outbound);
there is no CLA. The plugin API package, [`packages/plugin-api`](packages/plugin-api)
(`@cortex.md/api`), is [MIT licensed](packages/plugin-api/LICENSE) so plugins can use any license.
