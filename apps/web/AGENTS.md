# Cortex Landing Contracts

## Architecture

- Keep `src/routes/index.tsx` limited to route metadata and page composition.
- Landing content belongs in `src/content`, site URLs in `src/config`, and business logic in `src/server` or `src/lib`.
- Cortex Sync requests go through `@cortex/sync-api` (`request*` auth helpers, defensive mappers,
  `SyncError`). `src/server/sync/api.ts` adapts the cookie session into a `TokenProvider`; keep
  tokens in HttpOnly cookies and never add a second HTTP client.
- Passwords never reach the web server for KDF v1 accounts: `features/auth/AuthPage.tsx` calls the
  `prelogin` server fn, derives the Argon2id + HKDF `authKey` in the browser with
  `src/lib/accountKeys.ts` (`hash-wasm` + WebCrypto, byte-identical to desktop), and signup creates
  the X25519 identity there (no recovery key on web). KDF v0 accounts still send the raw password
  and are upgraded by the desktop app.
- Landing sections live one-per-file in `src/features/landing/sections`; shared landing primitives
  live in `src/features/landing/components`. Product pages follow the same pattern under
  `src/features/product/<page>`, with shared mock frames in `src/features/product/shared`.
- `SiteHeader` and `SiteFooter` are rendered once by `routes/__root.tsx`; pages never render their
  own header, footer, or `<main>`.
- Every route head goes through `createSeoHead`/`createPrivateSeoHead` (`src/seo/metadata.ts`) and
  JSON-LD helpers in `src/seo/structuredData.ts`. Private routes are `noindex` and excluded from
  `sitemap.xml`, which is the explicit route in `src/routes/sitemap[.]xml.ts`.
- Track product events only through `trackEvent` in `src/lib/analytics.ts`; never send emails,
  tokens, or vault ids.
- `@cortex/web` may only depend on `@cortex/sync-api` and `@cortex/ui`; registry parsing lives in
  `src/lib/registry`.
- Import shared UI primitives by subpath, such as `@cortex/ui/button`. Do not import the package barrel.
- Keep TanStack DevTools development-only and preserve server-side rendering and prerendering.
- Keep `apps/web/biome.json` as a nested Biome config with `root: false` so the repository root
  `bun run check` can traverse the workspace without conflicting root configurations.

## Product Claims

- Cortex is local-first, open source, and based on plain Markdown files.
- Describe sync as client-side encryption with encrypted blob storage. Do not make absolute security guarantees.
- Do not claim a public download, license, or platform release unless the repository adds one.
- Present open source as collaborative product trust, not a repository showcase. Keep GitHub links discreet.
- Keep Sync and Plugins as separate product stories: Sync explains ownership, encryption, history,
  and self-hosting; Plugins explains extension through a clear API example and practical benefits.

## Media

- Use `ProductMedia` for screenshots and GIFs.
- Reserve dimensions, lazy-load non-hero media, and give every image descriptive alternative text.
- Only the hero media receives eager loading and high fetch priority.

## Style

- Use Geist (sans) and Geist Mono, self-hosted via Fontsource (`@fontsource-variable/geist`,
  `@fontsource-variable/geist-mono`). Never load fonts from Google Fonts in production.
- Preserve the paper, ink, and amber editorial direction.
- Use Tailwind utilities for landing layout and component styling. `src/styles.css` is reserved for
  Tailwind imports, sources, theme mappings, CSS variables, and base element defaults.
- Do not add semantic layout classes or `@apply` back into `src/styles.css`.
- Use `font-mono` (Geist Mono) only for code, terminal output, permission keys, and other technical
  identifiers. Everything else uses Geist and creates hierarchy with size, weight, color, and spacing.
- Site tokens (`--site-*`, `bg-cell`, `bg-sep`, `shadow-ring`, `shadow-lift`) mirror the design canvas;
  never hardcode colors outside them except real theme palettes inside Marketplace screenshots.
- Breakpoints follow the canvas: tablet at `max-[1000px]:` and phone at `max-sm:` (640px).
- Section headings should not use numbered markers, eyebrow tags, or labels above the title unless
  the content is an actual ordered process.
- FAQ interactions use the standard shared accordion trigger appearance; collapse animation belongs
  in the shared accordion content primitive.
- Keep landing sections compact, with smaller editorial headings and grouped feature cards.
- Prefer a linear section intro above content over split headers with side descriptions.
- Avoid oversized text inside open-source manifesto cards; the section title already carries the
  headline.
- Footer placeholders for future resources must be visibly marked as `Soon` and must not be dead links.
- Keep motion subtle and respect `prefers-reduced-motion`.
