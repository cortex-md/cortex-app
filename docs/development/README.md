# Development Documentation

These guides are for contributors working on the Cortex codebase. The current default focus is the
desktop app and the shared packages used by desktop.

## Guides

- [Desktop development](desktop.md): how the Tauri desktop app is organized and how to run it.
- [Code quality](code-quality.md): checks, tests, React Doctor, and CI expectations.
- [Architecture practices](architecture-practices.md): package ownership, platform boundaries, and
  common implementation rules.

## Default Scope

The default root scripts target desktop:

```bash
bun run check
bun run typecheck
bun run check:boundaries
bun run test
bun run doctor
```

Mobile and web remain in the repository, but they are validated through explicit scripts while the
desktop app is the main contribution target.
