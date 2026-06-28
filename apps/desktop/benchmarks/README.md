# Desktop Large Vault Workbench

These scripts are diagnostic workbench tools for large-vault behavior. They live outside
`apps/desktop/src`, are not included by `apps/desktop/tsconfig.json`, and must not be imported from
runtime code.

Run quick smoke coverage before deeper profiling:

```bash
bun run benchmark:large-vault:smoke
```

Run the default large-vault workload:

```bash
bun run benchmark:large-vault
```

Run specific workloads or write raw measurements:

```bash
bun apps/desktop/benchmarks/large-vault-workbench.ts --scale large --only file-tree,search
bun apps/desktop/benchmarks/large-vault-workbench.ts --scale stress --json /tmp/cortex-large-vault.json
```

The output is intentionally not a pass/fail badge. Each row reports p50, p95, heap delta, and a
review signal so regressions and real bottlenecks stay visible instead of being hidden by a happy
path fixture. Heap delta is end-minus-start heap usage for the measured loop, so it can be negative
when garbage collection runs between samples.

Current workloads:

- `file-tree`: balanced, deep, and flat vault shapes through the desktop file explorer tree builder,
  visible-row projection, and interaction bookkeeping.
- `search`: indexing, common and rare full-text queries, tag filters, title queries, and
  serialization through `@cortex/search`.
- `renderer`: mixed Markdown and table-heavy notes through the shared renderer path.

Keep benchmark-only dependencies out of the desktop runtime dependencies. Prefer Bun, workspace
packages, and local scripts unless a profiling dependency is clearly isolated to dev-only tooling.
