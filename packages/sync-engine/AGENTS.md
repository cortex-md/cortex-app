# AGENTS.md

`@cortex/sync-engine` owns the desktop sync worker used by Electron's UtilityProcess.

## Ownership

- SQLite `sync.db` schema and accessors (`SyncDb`)
- Queue, merge, ignore preferences, SSE client, crypto helpers
- `SyncEngine` command handling and event emission
- `worker.ts` entry for `utilityProcess.fork`

## Boundaries

- Do not import React, `@cortex/ui`, or renderer code
- Desktop main process owns keychain bridging and event fan-out to the renderer
- Preserve existing IPC command names and `sync-*` event names expected by `@cortex/ipc`

## Validation

```bash
bun run test:sync-engine
```
