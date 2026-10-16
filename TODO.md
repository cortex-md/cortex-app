# TODO — Sync server

Pending server-side work identified during the Tauri → Electron migration and the sync-engine refactor.
Each item has a desktop counterpart already in place and only needs the server confirmation or change.

## Vault creation without a raw key

- `POST /sync/v1/vaults` now receives `encrypted_vault_key: ""` (desktop: `apps/desktop/electron/services/serverApi.ts`).
  Previously the raw VEK was sent in that field, which broke end-to-end encryption.
- The real key is created afterwards by `createVaultKey` (argon2id + encrypted VEK), sent to the
  encryption endpoint as `{ salt, encrypted_vek }` (`packages/sync-engine/src/vek.ts`).
- **Server:** accept an empty `encrypted_vault_key` on vault creation (or make the field optional) and
  treat `/vaults/{id}/encryption` as the source of truth for the key.

## Invites without the raw VEK

- When the client sends no key, the invite fallback now uses the server's password-wrapped
  `encrypted_vek` instead of the raw VEK (`apps/desktop/electron/services/serverApi.ts`).
- **Server:** confirm the invite-accept flow lets the invitee unlock the key with that payload (or
  define the per-member key-wrapping scheme).

## `X-File-Path` header with non-ASCII names

- Uploads send the vault-relative path in the `X-File-Path` header
  (`packages/sync-api/src/files.ts`). Header values must be ASCII, so notes with accents or
  other Unicode characters fail to upload. This was already broken in the Rust version.
- **Server:** pick an encoding and implement it, for example:
  - `X-File-Path` with percent-encoding (`encodeURIComponent`) decoded on the server, or
  - send the path in the body/query instead of a header.
- **Desktop:** after that, change only the header construction in `packages/sync-api/src/files.ts` (and the conflict and
  initial-sync call sites that use the same upload function).

## Local schema reset

- `sync.db` was recreated with a new schema (version 2). After the update, the first sync treats every
  file as having no local history.
- **Server:** make sure the full reconcile (list + hashes) is idempotent and does not create duplicate
  versions when the content hash matches.

---

# TODO — Mobile community plugins (step 5)

Resolved by the Obsidian model: mobile runs the same local plugin host as desktop inside one persistent
workspace WebView, next to the single CodeMirror editor. Bundled and community plugins share that realm.

## Why they run in the WebView (not in Hermes)

- The loader (`packages/plugin-host-core/src/communityPlugins.ts`) evaluates CJS bundles with `eval`/`data:` ESM imports, which Hermes does not support.
- App Store guideline 2.5.2 only tolerates downloaded executable code when it runs in WebKit (WebView).

## Delivered

- W1 (`@cortex/plugin-host-core`): the plugin bridge (`bridge/protocol.ts`, `createPluginHostMirror` in the
  host realm, `createPluginUiMirror` in native). The iframe guest runtime, remote context, context server,
  and snapshot tables were removed; desktop keeps local mode unchanged.
- W2 (`apps/mobile`): `features/workspace/` (`WorkspaceWebView`, `WorkspaceHost`, `workspaceChannel`,
  `workspaceProtocol`): one channel (`send` prop / `receive` handle), the core state mirror sent as diffs,
  forwarded async platform calls, the native plugin UI mirror, and `EditorView` `documentKey` so notes swap
  documents in one editor and keep undo history.
- C2 (mobile marketplace): Settings → Plugins → "Browse community plugins" installs, updates, and
  uninstalls into `.cortex/plugins/<id>/` through `@cortex/marketplace`; installed plugins are never enabled
  automatically.
- W3 (restricted mode): the app-level `plugins.allowCommunity` setting (off by default, same on desktop and
  mobile) is enforced only by `@cortex/plugin-host-core` (`services.community.isAllowed()`,
  `syncCommunityAccess()`). Settings → Plugins and the marketplace show the toggle/notice and block install
  while it is off; enabling a community plugin first confirms its declared permissions.

## Security model

- There is no isolation: a community plugin runs with the editor, the bundled plugins, and the bridge in
  the same realm (as on desktop). Native forwards only the platform methods in
  `forwardedPlatformMethods` and the typed workspace service calls, but any enabled plugin can use them.
- Safety rests on opt-in (restricted mode off by default, never auto-enabled, declared permissions shown
  before enabling), marketplace review, and scanning.

## What is left

- Simulator pass on iOS and Android: note switching keeps undo per note, keyboard/scroll/transitions without
  glitches, typing without lag, a community plugin (allow → install → enable → command/view/settings; turned off, nothing loads), and WebView
  crash/reload recovery.
- Store review: document the feature and confirm compliance before release.

---

# TODO — Desktop: Next design follow-ups

The "Desktop — proposta Next" page of the `Cortex — Desktop e Web` design
(https://claude.ai/artifact/5otEWbkTz5v4MFP3qh4PFV) is implemented on desktop. These items were left out on
purpose or need another owner.

## Deferred by decision

- Quick finder filter chips (Folder, Tag, Title only) and the sort menu (`NextCommand`, `NextQuickFinderCompact`).
- Marketplace theme Light/Dark previews and a curated "Discover" group: the registry and theme manifests carry no
  preview colours or curation flags yet (`NextMarketplaceThemes`).

## Desktop follow-ups

- Creating a new vault while another is open still switches the current window; Obsidian opens it in a new
  window. Route `createVaultFromFolder` through `openVaultWindow` when the window already has a vault.
- Verify on macOS that menu accelerators do not double-fire with the renderer hotkey listener (the renderer
  calls `preventDefault`, so Electron should not redispatch the key to the menu).
- `serverApi.selectServerUrl` is global; two windows syncing against different servers at the same time can
  race on the selected server.

- Splitting a pane remounts its `PaneView` and editors (`SplitPane.tsx` renders leaves and splits with different
  wrappers), losing CodeMirror scroll, undo and selection. Render leaves flat, keyed by pane id.
- Enable `<StrictMode>` after auditing CodeMirror and runtime effects for double-mount safety.
- Hotkeys in the Settings window do not show Vim command names, because the command registry only lives in the main
  window. Mirror the Vim choices if they are needed there.

## Mobile screens

The shared logic is ready in `packages/*`; mobile still needs UI for it:

- Search with tokens, suggestions and per-file matches (`@cortex/search` `tokenizeSearchQuery`, `getSearchSuggestions`,
  `buildSearchMatches`). Mobile also needs indexing enabled (`startAppRuntime({ indexing: "lazy" })` skips it today).
- Bookmarks with reorder (`bookmarksStore.reorderBookmark`) and tags with the tag page model (`buildTagTree`,
  `getTagPageModel`, `tagsStore.renameTag`).
- Outline and backlinks (`extractHeadings`, `useLinksStore`, `selectBacklinks`, `openWikiLink`).
- Back/forward over the note stack (`workspaceStore.navigateHistory`).

## Plugins (owned by the plugin host work)

- Render plugin views registered with `location: "sidebar-right"` inside `RightSidebar`
  (`apps/desktop/src/features/right-sidebar/RightSidebar.tsx`) next to Outline and Backlinks.
- Plugin settings pages with a React `component` cannot be mirrored into the Settings window; only schema pages are.
- Dedupe `MarketplaceArtwork` / `MarketplaceDetailArtwork` and split `PluginViewRenderer.tsx` per node type.

---

# TODO — Real-time collaboration

Live editing ships on desktop (E2EE Yjs rooms, live cursors, single file-sync leader per room). Remaining gaps:

- **Out-of-room edits on a live note:** when someone edits the same passage through regular file sync (mobile,
  a full room, offline) while a room is live, the leader keeps the live version (`kept-live` in the sync log).
  The other edit is only in version history. Consider surfacing it as a notice with a restore action.
- **Rename while live:** the server moves stored collab documents but not live rooms, so rows can be left under
  the old path. Server: close rooms on rename/delete (e.g. 4409/4410) so clients reopen on the new path.
- **Delete while a follower is live:** settling on close re-uploads the follower's local copy and can bring a
  deleted note back. Engine: treat a remote delete during a live session as final unless the note was edited.
- **Notes over 1 MiB** open without collaboration (`MAX_COLLAB_NOTE_BYTES`). Server message limit is 2 MiB and
  compaction is skipped above 1.4 MiB.
- **Mobile transport:** `@cortex/collab` and `@cortex/editor/collab` already run in the workspace WebView; mobile
  needs login, account keys (portable WebCrypto `AccountKeyCrypto`) and a native transport reusing
  `@cortex/collab/wire` before `platform.collab` can stop returning `"unsupported"`.
- **Manual two-profile pass:** run `bun run --cwd apps/desktop dev:profile -- alice` and `bob` against a test
  server and verify cursors, presence, read-only viewers, reconnect and leader handoff in the real UI.
