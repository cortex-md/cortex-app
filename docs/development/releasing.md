# Releasing

Maintainers cut releases from `main`. Contributors don't need this guide; it documents what the
workflows in `.github/workflows` expect.

## Desktop App

`release.yml` runs on a `v*` tag, or manually with a version input.

1. `scripts/release/resolve-desktop-release-metadata.mjs` validates the version. A version with a
   suffix, such as `0.2.0-beta.1`, becomes a prerelease.
2. Each platform (macOS Apple Silicon, Windows, Ubuntu) installs with
   `bun install --frozen-lockfile`. It then applies the version
   (`apply-desktop-release-version.mjs`), validates the sync server config
   (`validate-desktop-sync-config.mjs`), and builds and packages with electron-builder
   (`apps/desktop/electron-builder.yml`).
3. `publish-release` creates the GitHub release with every artifact, in the `release` environment.

```bash
git tag v0.2.0
git push origin v0.2.0
```

macOS signing and notarization need `MAC_CERTIFICATE_P12`, `MAC_CERTIFICATE_PASSWORD`, `APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`. Without them, macOS builds are unsigned
prereleases: auto-update and notifications don't work there. Electron fuses are on, so a local
unsigned build needs an ad-hoc identity to launch.

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
