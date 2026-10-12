# Benchmarks and performance tooling

Everything here is dev-only. It lives outside every production source tree, is never imported by
runtime code, and drives the desktop app from the outside, so nothing in this folder reaches the
desktop bundle.

| Command | What it measures |
| --- | --- |
| `bun run bench` | Micro benchmarks (`*.bench.ts`, `vitest bench`): bookmarks, file tree, live preview, note open |
| `bun run bench:large-vault` | Large-vault workbench: file tree, search index, renderer at 5k–100k notes |
| `bun run perf` | Real-app budgets from the roadmap against the built app |
| `bun run perf:monitor` | Live FPS, worst frame, long tasks, JS heap, RAM, and CPU while you use the app |

## `bun run perf`

Run `bun run build` first. The runner generates a vault (cached under the OS temp directory),
launches the built app with the isolated `perf-<scale>` development profile, and measures the
roadmap metrics with Playwright. The probes are injected at runtime with `page.evaluate`; the app
has no instrumentation of its own.

```bash
bun run perf                            # 50k notes, 5k-line note, 10k-row database
bun run perf -- --scale smoke           # 2k notes, quick check
bun run perf -- --json out.json         # raw samples for history
bun run perf -- --strict                # exit 1 when a budget is exceeded
```

| Metric | Budget (p95) |
| --- | --- |
| Launch until the restored note is editable | 1.5 s |
| Open a 5k-line note | 80 ms |
| Typing latency (key to end of input task) | 16 ms |
| Vault search | 100 ms |
| Quick Finder, per key | 30 ms |
| Switch tab / open Settings | 100 ms |
| Idle memory, all processes | 450 MB |
| Database with 10k rows: open / filter | 300 ms / 100 ms |

Scroll FPS for the large note and the database table is reported without a budget. It is capped
by the display refresh rate.

## `bun run perf:monitor`

```bash
bun run perf:monitor                         # smoke fixture
bun run perf:monitor -- --vault ~/MyVault    # your own vault, isolated profile
```

Prints one line per window every second. A trailing `!` marks a second with a frame longer than
50 ms or a long task. FPS comes from a `requestAnimationFrame` counter, so it reads as the display
refresh rate when the main thread is free.

The scripts that drive Electron run on Node (`--experimental-strip-types`) because Playwright's
Electron launcher does not work under Bun.
