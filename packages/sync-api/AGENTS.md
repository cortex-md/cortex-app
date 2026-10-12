# AGENTS.md

`@cortex/sync-api` is the single fetch-only client for the Cortex server, shared by desktop main,
the desktop sync worker (through `@cortex/sync-engine`), mobile, and web.

## Ownership

- `client.ts`: `ApiClient` (optional `X-Device-ID`, one 401 refresh-and-retry through a
  `TokenProvider`), `normalizeServerUrl`, `withQuery`, `segment`
- `errors.ts`: `SyncError` with `kind`, `status`, generic `code`/`detail` parsed from the JSON body,
  and `blockCode` for subscription denials; `expectOk`, `subscriptionAccessMessage`
- `mappers.ts`: defensive snake_case → camelCase mappers over `unknown` payloads (accept bare arrays
  or `{ devices | vaults | members | invites: [] }` wrappers; typed subscription `status`). The vault
  overview maps `my_access` (falling back to the role's base access when absent), `groups`,
  `access_rules`, and member `public_key`
- `endpoints.ts`: auth (`requestPrelogin`/`requestLogin`/`requestRegister`/`requestRefresh`/
  `requestLogout` return data without storing it; `login`/`register`/`logout` store through
  `AuthSession`; login responses carry `kdfVersion`/`publicKey`/`encryptedPrivateKey`), remote
  vaults, members/invites, groups (`listGroups`/`createGroup`/`updateGroup`/`deleteGroup`), path
  access rules (`listAccessRules`/`setAccessRule`; `null` when a rule was deleted), sealed vault keys
  (`getMyVaultKey` returns `null` on 404, `putMyVaultKey`, `listPendingVaultKeys`, `grantVaultKey`),
  devices, subscription status and checkout, legacy password-wrapped vault encryption records
  (`wrappedVaultKey`, `getVaultEncryption` with `hasMemberKeys`, `storeVaultEncryption`). Guest
  grant endpoints are gone; invite `grants[]` become user access entries server-side
- `files.ts`: sync file, history, and change-feed endpoints used by the sync engine.
  `listFileIndex` returns files plus `X-Latest-Event-ID` (seed the event cursor from it, never from
  `/changes`); `downloadBatch` streams `application/vnd.cortex.batch` frames
  (`[u32 header len][JSON header][u64 body len][body]`) to a callback without buffering the whole
  response; uploads send `X-File-Path` URI-encoded with `X-File-Path-Encoding: uri`;
  `updateVaultCursor` reports the per-vault cursor. Versions are the server's file version (the one
  `X-Base-Version` is compared with): `downloadFile` returns `{ bytes, version }` and a numeric
  `version` resolves to the content in effect at that version; `uploadFile` and `deleteFile` accept
  a base version and fail with `isVersionConflict` on `409 conflict`; `fileInfo` reads the current
  remote state
- `account.ts`: capabilities, profile, email/password, avatar, account overview, identity key
  endpoints (`getAccountKeys`, `updateAccountKeys`, `updateAccountRecovery`) and password reset
  (`preparePasswordReset`, `resetAccountPassword`)
- `accountKeys.ts`: the account key model without crypto primitives. `AccountKeyCrypto` is injected
  (desktop passes `nodeAccountKeyCrypto` from `@cortex/sync-engine`); `AccountKeyStore` keeps the
  X25519 identity private key only in the secret store as `identity_<userId>` (cleared on logout)
  and implements key status, `setupKeys`, recovery regeneration, KDF-aware password change and
  password reset. KDF v1 accounts send the derived `authKey` instead of the password; v0 accounts
  log in with the raw password and are upgraded with `PUT /account/v1/me/keys`, returning the
  recovery key to the UI. New passwords need at least 8 characters before deriving
- `collab.ts`: `createCollabTicket(api, vaultId, filePath)` (`POST
  /sync/v1/vaults/{id}/collab/tickets` with `{ file_path }`, returns `{ ticket, expiresAt }`; tickets
  live one minute, so request one per connection attempt) and `collabSocketUrl(serverUrl, vaultId,
  path, ticket)` (ws/wss URL of `/sync/v1/vaults/{id}/collab` with `frames=binary`). Frame codecs
  and crypto live in `@cortex/collab/wire`
- `shares.ts`: public note link endpoints (list/create/publish ciphertext/expiry/revoke) and the
  public `fetchSharedContent`; it never sees link keys or plaintext
- `session.ts`: `AuthSession` (scoped token keys hashed with `@cortex/platform/hash`, single-flight
  refresh, `onSessionExpired` on 401/403)
- `secrets.ts`: synchronous `SecretStore` and `createCachedSecretStore(keychain)` (lazy `preload`,
  write-behind) for async keychains such as mobile SecureStore; secret key names `vekSecretKey`
  and `identitySecretKey`
- `services.ts`: `createServerApiServices({ secrets, getDeviceInfo, onSessionExpired, ... })` returns
  the platform `Auth`, `Account`, `Devices`, `Members`, `Subscription`, `RemoteVault`
  implementations plus `checkVaultEncryption`, `session`, `keys`, `currentUserId`,
  `currentIdentity`, `selectServerUrl`, and `client`. Without `keyCrypto` (mobile) KDF v1 accounts
  cannot sign in and key methods reject.
  Optional hooks: `resetDeviceId` (login retries once with a fresh device id on
  `409 device_conflict`), `createInviteKeyLink`/`storeInviteKey` (invite links carry the vault key
  wrapped with a random link key in the `#k=` fragment, which never reaches the server). Clients
  without the hooks fall back to the password-wrapped vault key.

## Boundaries

- Only `fetch`, Web APIs, and `@cortex/platform`. No `node:`, Electron, argon2, SQLite, React, or DOM
  globals (enforced by `check-workspace-boundaries.ts`).
- Desktop instantiates the services in the main process so tokens never reach the renderer. Web keeps
  tokens in cookies and builds its own `TokenProvider`; it uses the `request*` functions.
- Argon2, X25519, and HKDF stay in `@cortex/sync-engine` (desktop) or the web app's browser code;
  this package only orchestrates them through `AccountKeyCrypto`.

## Validation

```bash
npx tsc -b packages/sync-api
bun run check:boundaries
```
