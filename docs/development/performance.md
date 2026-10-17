# Performance

Performance changes are measured, not guessed. Profile first, change one thing, and keep the change
only if the numbers move. All tooling lives in `tools/benchmarks`, which documents every command
and budget in its [README](../../tools/benchmarks/README.md).

## Workflow

1. Build the app. `bun run perf` drives the built app, not the dev server:

   ```bash
   bun run build
   ```

2. Record a baseline before editing:

   ```bash
   bun run perf -- --scale smoke --launches 1   # 2k notes, about 3 minutes
   bun run perf -- --scale roadmap --launches 1 # 50k notes, the budgets that matter
   ```

3. For algorithm work, run the micro benchmarks and the large-vault workbench:

   ```bash
   bun run bench
   bun run bench:large-vault
   ```

4. Make the change, rebuild, and measure again with the same command. Single launches are noisy,
   so repeat a run before you trust a regression or a gain.
5. Keep the change only when the gain shows up in the numbers.

Do not edit sources while `bun run build` is running; the build reads files as it goes.

`bun run perf:monitor` prints live FPS, long tasks, heap, RAM, and CPU while you use the app. It is
useful for finding what to profile.

## Budgets

The roadmap budgets (p95, 50k-note vault) are in the benchmarks README. The main ones:

| Metric | Budget |
| --- | --- |
| Launch to typing | 1.5 s |
| Open a 5k-line note | 80 ms |
| Typing latency | 16 ms |
| Quick Finder or Command Palette, first open / next opens | 120 / 50 ms |
| Quick Finder, per key | 30 ms |
| Vault search | 100 ms |
| Database with 10k rows: open / filter | 300 / 100 ms |
| Idle memory, all processes | 800 MB |

## Rules That Came From Measuring

- **Lazy loading:** keep heavy modules lazy. CodeMirror values load through the `@cortex/editor`
  runtime loader, and overlays are preloaded at idle.
- **Incremental updates:** prefer patching over rebuilding. `VaultIndex` deltas replaced full tree
  rebuilds. One change at 50k files went from about 30 ms to 0.25 ms.
- **Renderer thread:** keep parsing off it when it can move. Search snippets are built in the
  search worker.
- **Startup work:** do not run two heavy jobs at once on the renderer during startup. Running
  search and metadata indexing in parallel made the first Quick Finder open about five times
  slower.
- **Concurrency:** measure any limit before adding it. A 32-way `stat` limit in `scanVault` made
  opening a vault 1.8 s slower at 50k files, because the waiting queue was the bottleneck.
- **React Compiler:** measured and dropped. It brought no gain and added memory and build time.
