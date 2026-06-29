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
bun run check:all
```

## TypeScript

The default TypeScript gate uses `tsconfig.desktop.json`:

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

That runs desktop frontend suites and Rust tests. Use narrower commands while iterating:

```bash
bun run test:desktop:frontend
bun run test:rust
bun run --cwd packages/core vitest run
bun run --cwd apps/desktop vitest run
```

## React Doctor

Run React Doctor after React-facing desktop changes:

```bash
bun run doctor
```

Mobile has its own explicit command:

```bash
bun run doctor:mobile
```

## CI Expectations

Automatic CI is desktop-scoped. It should run:

- Biome lint and check for desktop/shared desktop packages.
- Desktop TypeScript project references.
- Workspace boundary checks.
- Desktop frontend Vitest suites.
- Rust fmt, check, and tests for the Tauri workspace.
- React Doctor for desktop React changes.

The full monorepo gates remain available for maintainers when mobile or web work is in scope.
