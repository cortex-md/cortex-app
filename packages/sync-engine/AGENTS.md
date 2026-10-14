# AGENTS.md

`@cortex/sync-engine` owns the platform-agnostic sync engine. The server HTTP client lives in
`@cortex/sync-api`. Each platform calls `configureSyncRuntime` once per process with its
`SyncRuntime` (crypto primitives, `SyncFs`, `SyncPath`, `openDatabase`, `randomUUID`) before any
engine or key function runs. Desktop provides `apps/desktop/electron/platform/nodeSyncRuntime.ts`
and runs the engine in Electron's UtilityProcess from `apps/desktop/electron/syncWorker.ts`.

## Ownership

- `vek.ts` (desktop main only; the worker never imports it): `createVaultKey` generates a VEK and
  seals it to the user's own public key (no vault password), `requestVaultKey` opens the sealed key
  from `GET keys/me` (`"pending"` when missing or unreadable), `ensureOwnVaultKey` re-upserts the
  own sealed row when it is missing or stale, and `unlockVaultKey` is the legacy vault-password
  fallback. Encryption status reads are HTTP-only and live in `@cortex/sync-api`.
- `keys.ts`: X25519 identity keys, sealed VEKs (`0x01 || ephPub || AES-GCM(HKDF(shared,
  ephPub||recipientPub, "cortex/vek-seal/v1"))`), Crockford base32 recovery keys, recovery wraps,
  and fingerprints, all through `syncRuntime().crypto`
- `accountCrypto.ts`: Argon2id (64 MiB, 3 passes) + HKDF account key derivation and
  `accountKeyCrypto` for `@cortex/sync-api` account flows. The web app
  mirrors the derivation byte for byte with `hash-wasm` and WebCrypto
- SQLite `sync.db` schema and accessors (`SyncDb`) over the injected synchronous `SqlDatabase`
- `runtime.ts`: the `SyncRuntime` contract; `bytes.ts`: `Buffer`-equivalent byte helpers (base64,
  base64url, hex, UTF-8, concat, equality)
- Queue, cursor, planner, transfer, merge, SSE client, crypto and VEK flows. Ignore rules come from
  `@cortex/platform/sync-rules`, content hashes from `@cortex/platform/hash` (BLAKE3), and
  vault-relative paths from `@cortex/platform/utils` `toVaultRelativePath(path, vaultPath)`
- `SyncEngine` command handling and event emission
- Full sync (`runner.ts`) downloads through `/files/batch` in chunks of 100 files or 32 MB and
  uploads with a pool of 4; note creators come from `created_by` in the file list (no per-file
  history lookups). After a full sync the event cursor is reset to the list's `X-Latest-Event-ID`,
  and the cursor is reported to the server per vault every 30 s and on stop. Files whose local hash
  already matches the list are settled in one transaction (hash, mtime/size, server version); a
  missing local file with an unchanged remote is deleted remotely, an unchanged local file missing
  remotely is deleted locally, and files in `conflict` are left for manual resolution. Queued
  remote downloads are drained through the same batch endpoint.
- Versions: `fileState.serverVersion` is the server's current file version at the last sync
  (from upload/rename results, the file list, events, and `X-File-Version`). Uploads always send
  `X-Base-Version` (0 for files without sync state). On `409 conflict` the engine reads
  `/files/info`: same checksum → synced; unchanged content (rename/restore bumps) → retry with the
  new base; otherwise download, three-way merge, write locally, and push with the new base.
- Merges (`merge.ts`, `conflict.ts`): Markdown uses a line-based three-way merge (overlapping
  edits become `<<<<<<< LOCAL` / `>>>>>>> REMOTE` hunks), `.cortex/*.json` merges by key, other
  files keep local and push it (the remote stays in server history). The ancestor is fetched by
  `serverVersion` and verified against `ancestorHash`, falling back to the history entry with that
  checksum; without an ancestor text files become a manual conflict, never an empty-ancestor merge.
  Conflicted files are not auto-uploaded; `keep_local` strips the remote side of the markers.
  Remote deletes never remove locally modified files (they are re-uploaded instead).
- Queue: failed ops back off (30 s … 6 h) and are dropped after 10 attempts or non-retriable
  errors (their source event then counts as processed); backoff resets when the SSE reconnects.
  Subscription (402) errors from any request, and 403s from vault-scope requests (overview, file
  index, changes, SSE, cursor), stop the engine with `sync-vault-access-denied`. A 403 on a single
  file (upload, download, batch frame, history, restore RPCs) is path-level: it is logged as
  "skipped: no access", the op is dropped without retry, and the vault keeps syncing
  (`accessDenial(error, "path")`, `isPathForbidden`).
- Access fails closed: the last effective access is stored in `sync.db` meta
  (`lastEffectiveAccess`). When the overview lookup fails, the engine uses that cached access or
  `READ_ONLY_ACCESS` until a later refresh succeeds (retried on the queue reload timer), and never
  falls back to full access. The planner, remote events, and history/restore/rename/resolution
  paths all check `canRead`/`canWrite`; a file moved into an unreadable folder is removed locally.
- `sync.db` migrations are additive per `SCHEMA_VERSION` (`MIGRATIONS` in `db.ts`); unknown
  versions are rebuilt from scratch and repaired by the next full sync.
- `access.ts`: evaluates the overview's `myAccess` (`EffectiveAccess`, deepest matching rule
  wins, else the base level). Unwritable paths are never uploaded or deleted remotely: diverging
  local content is restored from the server ("Discarded local changes to read-only X"), new local
  files there stay local and are logged once as "not synced (read-only)". Unreadable paths are not
  treated as remote deletions; on every full sync tracked files that became unreadable are removed
  locally when unmodified and kept (untracked, logged) when modified
- Vault SSE events: `access_changed`/`member_role_changed`/`member_removed` refetch the overview,
  emit `sync-access-changed`, and run a full sync when access changed. Owner/admin sessions
  auto-grant the VEK (sealed to each pending member's public key) on start and on `member_joined`,
  `member_key_changed`, and `access_changed`. Member key fingerprints are pinned TOFU in
  `memberKeyPins` (schema v4); a changed fingerprint blocks the grant and emits
  `sync-key-trust-issue` until `trustMemberKey` pins the new one
- `inviteKey.ts`: wraps/unwraps the vault key for `#k=` invite links (desktop main only)
- `shareCrypto.ts`: link keys for public note links (wrapped with the VEK) and gzip + AES-GCM
  sealing of share bundles (desktop main only)
- Live collaboration roles (`setCollabRole { path, role }`, kept by the engine across `start` and
  cleared on `stop`; desktop main re-sends them when the worker respawns). `follower`: local
  changes and deletes for the path are ignored, queued `upload`/`deleteRemote`/`delete`/`restore`
  ops are skipped, and remote changes only adopt the server version as the new base
  (`transfer.adoptRemoteVersion` via `/files/info`, or the already downloaded hash in
  `applyRemoteContent`) without writing the file or touching `localHash`. `leader`: normal sync,
  except a Markdown merge conflict keeps the local (live) side via `takeConflictSide(..., "local")`,
  pushes it, and logs "kept live version" (outcome `kept-live`). Clearing a role queues a `settle`
  op (`transfer.settleOrUpload`): remote checksum equal to the local hash → mark synced; local
  unchanged since the adopted base, or read-only → apply the remote; local file gone → delete
  remotely; otherwise upload against the adopted base
- `protocol.ts`: typed worker ⇄ main messages and RPC correlation

## Boundaries

- Do not import React, `@cortex/ui`, or renderer code
- No `node:*`, `Buffer`, `argon2`, `process`, or Electron in `src`; go through `syncRuntime()` and
  the `bytes.ts` helpers so mobile can provide its own runtime
- Desktop main process owns the keychain and is the only token refresher; the worker asks main for
  access tokens, refreshes and VEKs through `MainMethods`
- Server-provided paths must go through `resolveInVault` before touching the filesystem
- Event names and payloads must match `MainEvents` in `apps/desktop/electron/contract.ts`

## Validation

```bash
bun run test -- --project desktop-electron
npx tsc -b packages/sync-engine
```
