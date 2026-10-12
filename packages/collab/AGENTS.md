# AGENTS.md

`@cortex/collab` is the portable real-time collaboration layer (Yjs + end-to-end encryption) shared
by the desktop renderer, the desktop main process, and the mobile workspace WebView.

## Boundaries

- Portable source only: no `node:*`, Electron, React, CodeMirror, or DOM identifiers (enforced by
  `scripts/check-workspace-boundaries.ts`). Workspace dependency: `@cortex/platform` only.
- The vault key (VEK) never reaches the renderer or the WebView. Only the transport host (desktop
  main today, native mobile later) derives the collab key and seals/opens payloads.

## Wire (`@cortex/collab/wire`)

`src/wire/` must not import `yjs`; it is what transport hosts import.

- `frames.ts`: `COLLAB_OPS` (`syncStep1` 1, `syncStep2` 2, `update` 3, `awareness` 4),
  `encodeClientFrame(op, payload)` → `[op][payload]`, `decodeServerFrame(bytes)` reads
  `[op][sender len u8][sender][payload]` and returns `null` for malformed frames,
  `parseControlMessage(text)` maps the server JSON (`welcome` with `client_id`, `up_to`, `from`,
  `peers`; `synced`; `peer_joined`; `peer_left`; `ping`) to typed messages whose names match
  `CollabChannelEvent` (`peer-joined`, `peer-left`), and `encodeCompactMessage(sealedState, upTo)`
  builds `{"type":"compact","data":base64,"up_to":n}`. `COLLAB_MAX_FRAME_BYTES` is 2 MiB - 64
  (the server read limit is 2 MiB per message).
- `crypto.ts`: `deriveCollabKey(vek)` = HKDF-SHA256(ikm = VEK, no salt, info
  `"cortex/collab/v1"`, 32 bytes). `sealCollabPayload(key, vaultId, plaintext)` →
  `[0x01][nonce 12][ciphertext || tag 16]` with AES-256-GCM (`@noble/ciphers`) and AAD
  utf8(`"cortex/collab/v1:" + vaultId`); `openCollabPayload` throws on any failure. The AAD binds
  the vault only: the server re-sends stored `sync_step2` as `update` and moves rooms on rename,
  so op and path cannot be authenticated.
- Every payload is sealed: updates, awareness, `sync_step1`, and compacted state. The server is an
  opaque relay; `collab_updates.data` and `collab_documents.compacted_state` hold envelopes only.
- Server stream order per connection: `welcome` (JSON) → compacted state as `sync_step2` → stored
  and buffered updates as `update` → `{"type":"synced"}` → live frames. Initial-state frames have
  an empty sender. Viewers' `update`/`sync_step2`/`compact` are dropped by the server.

## Transport contract (desktop main)

- `Collab.open` resolves once the channel is registered; transport failures arrive as a single
  `closed` event and the channel is dead afterwards (the session reconnects with a new `open`).
  Ticket failures map HTTP 401/402/403 to `unauthorized`/`subscription`/`forbidden`, everything
  else to `network`. It rejects only when the request is invalid or the vault is locked.
- Close codes: 1000 normal, 1001 server-shutdown, 1008 room-full, 1013 buffer-full, 4402
  subscription, 4403 access-changed, 4408 too-slow, anything else network. A frame above
  `COLLAB_MAX_FRAME_BYTES` closes the channel with `too-large` (1009); an oversized compaction is
  skipped. Undecryptable frames are dropped and logged once per channel.

## Core (`@cortex/collab`)

The root entry imports `yjs` and `y-protocols`; consumers load it lazily (`import("@cortex/collab")`)
so neither ships until the first live session. `@cortex/collab/constants` is dependency-free and
safe to import statically.

- `document.ts`: `CollabNoteDocument` owns one `Y.Doc` with `frontmatter` and `body` `Y.Text`, an
  `Awareness`, and one `Y.UndoManager` over both texts that starts with no tracked origins (the
  CodeMirror binding adds its own, so only local editor edits are undoable). `applyParts` diffs
  both texts in one transaction; `seed` applies a scratch doc whose clientID is a 32-bit hash of the
  content, so identical simultaneous seeds dedupe; `isLocalEditorTransaction` identifies editor and
  undo transactions.
- `textDiff.ts`: `applyTextDiff` keeps the common prefix and suffix (surrogate-safe) and replaces
  only the middle.
- `leader.ts`: `electFileSyncLeader` picks the lowest Yjs clientID among awareness states with
  `canWrite` and `fileSync`, optionally excluding one server session id.
- `session.ts`: `CollabSession` drives one `CollabChannel` (plaintext payloads). It records
  `welcome` (`upTo`, `canWrite`, peers), applies `update`/`sync_step2` with `REMOTE_ORIGIN`, and
  answers a peer `sync_step1` with an `update` only when it is the elected responder (never sends
  `sync_step2`). On `synced` it reconciles with the local file (empty Y → seed; differs and alone
  → local wins with `RECONCILE_ORIGIN`; differs with peers → Y wins and a pre-sync snapshot is
  taken when local changes are unsaved), sends what the server lacks (diff against a scratch doc of
  the received backlog), sends its own `sync_step1`, and publishes awareness
  `{user, session, canWrite, fileSync, cursor}`. Local updates are merged and flushed every 40 ms
  or at 64 KiB; awareness is throttled to 100 ms. File-sync role: `follower` while connecting or
  offline, elected `leader`/`follower` when live, `null` when unavailable or disposed. Reconnects
  with 1–30 s exponential backoff and jitter on `normal`, `network`, `too-slow`, `buffer-full`,
  `server-shutdown`, and `access-changed`; any other close reason ends in `unavailable`. `dispose`
  flushes, compacts when it is the last writing leader (skipped above 1.4 MiB), clears awareness,
  closes the channel, and sets the role to `null`. Snapshots (`status`, `reason`, `role`,
  `canWrite`, `ready`, `peers`) change only on those fields, never on cursor movement.
- `registry.ts`: `createCollabRegistry` keeps one document and session per note path. `retain`
  returns the entry, `release(entry)` closes it after a 30 s grace period, `rename` keeps the
  document and reopens the session on the new room, and `attach(entry)` lets the host bind
  persistence for the entry's lifetime.
- `colors.ts`: `collabUserColor(userId)` returns a deterministic `{ color, colorLight }`.
- Never use the identifier `document` in this package (portable boundary rule); use `noteDocument`.

## Validation

```bash
npx tsc -b packages/collab
bun run check:boundaries
```
