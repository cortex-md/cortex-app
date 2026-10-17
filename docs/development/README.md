# Development Documentation

Guides for contributors working on the Cortex codebase. Read [CONTRIBUTING.md](../../CONTRIBUTING.md)
first for the workflow, then the guide for the area you are changing.

| Guide | Covers |
| --- | --- |
| [Architecture](architecture.md) | Runtimes, packages, dependency boundaries, day-to-day rules |
| [Desktop development](desktop.md) | Running the Electron app, IPC, the main process, the sync worker |
| [Vault data model](data-model.md) | `VaultIndex`, note metadata and search indexes, state files, the `.cortex` layout |
| [Code quality](code-quality.md) | Biome, TypeScript, the testing policy, React Doctor, CI |
| [Performance](performance.md) | Measuring with `bun run perf` and the benchmarks, budgets |
| [Releasing](releasing.md) | Desktop releases and publishing `@cortex.md/api` |

Each package also has an `AGENTS.md` with its local rules, written for people and coding agents
alike. Read the root `AGENTS.md` and the one closest to the code you change.

## Default Gate

```bash
bun run check
bun run typecheck
bun run check:boundaries
bun run test
```

Mobile and web are validated through explicit scripts (`check:mobile`, `check:web`,
`typecheck:all`) when your change touches them.
