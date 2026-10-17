# Code Quality

Cortex uses desktop-first quality gates while the desktop app is the primary contribution target.

## Formatting And Linting

Biome owns formatting, linting, and import organization for TypeScript, JavaScript, JSON, and CSS.

```bash
bun run check
bun run check:fix
```

The default `check` scope covers `apps/desktop`, desktop-owned shared packages, bundled plugins, and
desktop benchmark tooling. It intentionally does not block on `apps/mobile` or `apps/web`.

Use explicit scopes when needed:

```bash
bun run check:web
bun run check:mobile
```

## TypeScript

The default TypeScript gate builds the desktop projects (`apps/desktop`, its Electron and Node configs, and `plugins`):

```bash
bun run typecheck
```

Use the full monorepo typecheck only when you are intentionally validating mobile and web too:

```bash
bun run typecheck:all
```

## Tests

The default test command is the desktop gate:

```bash
bun run test
```

That runs every desktop-scoped Vitest project declared in the root `vitest.config.ts` in a single
process. Narrow it with `--project` while iterating:

```bash
bun run test -- --project desktop
bun run test -- --project core
bun run test -- --project sync-engine
bun run test:watch -- --project editor
```

Tests cover features where a regression loses data or breaks third-party code: sync (planner,
merge, conflicts, crypto), external plugin and theme loading, vault and frontmatter persistence,
the vault index and note metadata index, import/export, sanitization, and settings migration. Do
not add render tests for individual components or tests for trivial stores, getters, or CSS
classes. A test should fail if the behavior it protects breaks; don't write tests just to raise
coverage.

Put tests next to the code they cover (`*.test.ts` or `__tests__/`). Prefer pure functions for
the rules worth testing, such as the extension sync planner or the inline tag scanner, so tests
need no platform mocks.

## React Doctor

Run React Doctor after React-facing desktop changes:

```bash
bun run doctor
```

Mobile has its own explicit command:

```bash
bun run doctor:mobile
```

## CI

| Workflow | Runs on | Checks |
| --- | --- | --- |
| `ci.yml` | Pushes and pull requests | `check`, `typecheck`, `check:boundaries`, `test`, and React Doctor on pull requests |
| `apps.yml` | Changes under `apps/mobile`, `apps/web`, `packages`, or `bun.lock` | Mobile and web lint, types, and tests |
| `perf.yml` | Weekly and on demand | `bun run perf` budgets against the built app |

Run the desktop gate locally before opening a pull request. The full monorepo gates
(`typecheck:all`, `check:mobile`, `check:web`) are for changes that touch mobile or web.
