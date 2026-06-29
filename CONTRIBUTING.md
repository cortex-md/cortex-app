# Contributing To Cortex

Thanks for taking the time to help improve Cortex. This repository is open to bug reports, feature
ideas, docs improvements, design feedback, and pull requests. The current contribution focus is the
desktop app.

## Before You Start

- Search existing issues before opening a new one.
- For small fixes, feel free to open a pull request directly.
- For larger features, public APIs, sync behavior, editor behavior, or package boundary changes,
  open an issue first and describe the problem, proposed approach, and tradeoffs.
- Keep pull requests focused. A small, well-tested PR is much easier to review than a broad mixed
  refactor.

## Local Setup

Install dependencies from the repository root:

```bash
bun install
```

Run the desktop app:

```bash
bun run dev:desktop
```

If you are on Linux, install the Tauri desktop dependencies listed in [README.md](README.md).

## Default Validation

Run the desktop gate before opening a pull request:

```bash
bun run check
bun run typecheck
bun run check:boundaries
bun run test
```

Use React Doctor after React-facing desktop changes:

```bash
bun run doctor
```

The default scripts intentionally target desktop and desktop-owned shared packages. Mobile and web
validation is explicit:

```bash
bun run check:mobile
bun run check:web
bun run test:mobile
bun run test:web
bun run typecheck:all
```

## Pull Request Checklist

- The change has a clear problem statement.
- Desktop behavior was tested locally.
- New or changed behavior has focused tests when practical.
- `bun run check`, `bun run typecheck`, `bun run check:boundaries`, and `bun run test` pass.
- React-facing desktop changes were checked with `bun run doctor`.
- Documentation was updated when behavior, setup, commands, or public contracts changed.
- The PR does not include unrelated formatting, generated output, or drive-by refactors.

## Development Guidelines

Read [docs/development/README.md](docs/development/README.md) before making non-trivial changes.
The most important rules are:

- Keep desktop-specific composition in `apps/desktop`.
- Put shared app logic in the package that owns the contract.
- Access native functionality through `@cortex/platform`, not directly from React UI.
- Use `@cortex/ui` primitives for app UI.
- Keep plugin-facing contracts inside `@cortex.md/api` and avoid leaking internal packages.
- Update docs when you change a workflow or public behavior.

## Issues

Good bug reports include:

- What happened.
- What you expected to happen.
- Steps to reproduce.
- Operating system and app build information when relevant.
- Screenshots, logs, or a small vault example when useful.

Good feature requests include:

- The workflow or user problem.
- Why the existing behavior is not enough.
- Any alternatives you considered.
- Whether you are interested in contributing the change.

## Review Process

Maintainers may ask for smaller scope, extra tests, docs updates, or a different package boundary.
That is normal. The goal is to keep Cortex easier to change over time while still moving quickly.

Please keep discussion respectful and specific. Assume good intent, explain tradeoffs clearly, and
prefer concrete examples over broad claims.
