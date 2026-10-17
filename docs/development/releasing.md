# Releasing

Maintainers cut releases from `main`. Contributors don't need this guide; it documents what the
workflows in `.github/workflows` expect.

## Desktop App

`release.yml` runs on a `v*` tag, or manually with a version input.

1. The commit must be on `main`. `scripts/release/resolve-desktop-release-metadata.mjs` validates
   the version. A version with a suffix, such as `0.2.0-beta.1`, becomes a prerelease. The run
   stops here unless `release-notes/<version>.md` exists.
2. Each platform (macOS 26 Apple Silicon and Intel, Windows, Ubuntu) installs with
   `bun install --frozen-lockfile` and runs the main-process tests. It then applies the version
   (`apply-desktop-release-version.mjs`), validates the sync server config
   (`validate-desktop-sync-config.mjs`), and builds and packages with electron-builder
   (`apps/desktop/electron-builder.yml`). Electron and electron-builder downloads are cached per
   OS and architecture.
3. `publish-release` waits for every platform and downloads the artifacts once. In the `release`
   environment, `scripts/release/create-update-manifest.mjs` writes `cortex-update.json` (version,
   channel, notes, SHA-256 and size of each update package) and signs it into
   `cortex-update.json.sig` with `CORTEX_UPDATE_PRIVATE_KEY`; it fails when a required platform
   (`darwin-arm64`, `darwin-x64`, `win32-x64`, `linux-x64`) has no package. The same job then
   creates the GitHub release with the notes file as its body, the installers, the update
   packages, and the signed manifest.

```bash
$EDITOR release-notes/0.2.0.md   # intro paragraph, then "### New" and "### Fixed" lists
git tag v0.2.0
git push origin v0.2.0
```

The notes file is the single source for the GitHub release, the site changelog (which reads the
`New` and `Fixed` sections), and the update notes inside the app.

App icons live in `apps/desktop/build/`: `icon.icon` is the Icon Composer source for macOS (Liquid
Glass, dark and tinted variants, plus a generated `.icns` for older macOS), compiled in CI with
Xcode 26 on macOS 26 runners (`-c.mac.icon=icon.icon`); `icon.png` (1024 px) is the source electron-builder converts for
Windows, Linux, and local macOS builds, which skip the `.icon` because they lack Xcode 26.

Artifacts are named `Cortex-<os>-<arch>.<ext>` without the version, so
`releases/latest/download/<name>` links on the site always point at the newest release. Deploy
site changes that rename download links only after that release is published. Update packages are the mac `zip`, the
Windows NSIS `exe`, and the `AppImage`; `dmg`, `deb`, and `rpm` are for manual installs only.

macOS signing and notarization need `MAC_CERTIFICATE_P12`, `MAC_CERTIFICATE_PASSWORD`, `APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`. Without them, macOS builds are ad-hoc signed
(required on Apple Silicon): users approve the first launch once, and the built-in updater works
afterwards because it does not depend on Squirrel.Mac. Native notifications still need a signed
build. Electron fuses are on, so a local unsigned build needs an ad-hoc identity to launch.

### Update Signing Key

Generate the Ed25519 pair once, from a trusted machine:

```bash
node scripts/release/generate-update-keys.mjs --out ~/cortex-update-key
```

- Paste the printed public key into `apps/desktop/electron/updates/publicKey.ts` and release it.
- Store the content of `cortex-update.key` as the `CORTEX_UPDATE_PRIVATE_KEY` secret of the
  `release` environment, then delete the local copy or keep it offline.
- Never rotate the key casually: installed builds accept only manifests signed by the key they
  shipped with. A new key must first ship in a release signed with the old one.

Release format: `cortex-update.json` holds `version`, `channel` (`stable`, or `beta` for versions with a
suffix), `releasedAt`, `notes`, and `platforms` keyed by `<platform>-<arch>` with `type`
(`zip`, `nsis`, `appimage`), `url`, `sha256`, and `size`. The signature covers the exact bytes of
the file. Stable clients read `releases/latest/download/cortex-update.json`; beta clients read the
newest release that has a manifest, so prereleases update beta users only. The name is not
`latest.json` because v0.1.x (Tauri) builds poll that file and expect the Tauri format; they update
to 0.2 manually.

## Plugin API (`@cortex.md/api`)

`publish-plugin-api.yml` is manual (`workflow_dispatch`).

- It publishes `packages/plugin-api` to npm from the `npm` environment with provenance (OIDC
  `id-token: write`).
- The version comes from the input, or else from `packages/plugin-api/package.json`. A version
  that already exists on npm is skipped.
- `npm pack --dry-run` runs before publishing, so the tarball contents show in the log.

When the plugin contract changes, also update the CLI rules and the Marketplace registry
validator, which mirror the app's contract. Their repositories are `cortex-md/cli` and
`cortex-md/registry`.

## Plugins and Themes

Community extensions are released from their own repositories with the Cortex CLI. See the website
docs: `apps/web/src/content/docs/plugins/publishing-and-review.mdx` and
`apps/web/src/content/docs/themes/publishing-and-review.mdx`.
