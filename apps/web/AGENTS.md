# Cortex Landing Contracts

## Architecture

- Keep `src/routes/index.tsx` limited to route metadata and page composition.
- Landing content belongs in `src/content`, site URLs in `src/config`, and business logic in `src/server` or `src/lib`.
- Landing sections live one-per-file in `src/features/landing/sections`; shared landing primitives
  live in `src/features/landing/components`.
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

- Use the macOS system font stack with `-apple-system`, `SF Pro Text`, and `SF Pro Display` first.
- Preserve the paper, ink, and amber editorial direction.
- Use Tailwind utilities for landing layout and component styling. `src/styles.css` is reserved for
  Tailwind imports, sources, theme mappings, CSS variables, and base element defaults.
- Do not add semantic layout classes or `@apply` back into `src/styles.css`.
- Product feature cards must use the shared `FeatureCard`, which wraps `@cortex/ui/card`.
- Landing components must not use `font-mono` or `font-display`; use the system font stack and
  create hierarchy with size, weight, color, and spacing.
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
