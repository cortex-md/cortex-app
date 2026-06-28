# Cortex Web

The public Cortex web app, built with TanStack Start, React, Tailwind CSS, and the shared `@cortex/ui` package.

## Development

Run from the monorepo root:

```bash
bun install
bun run --cwd apps/web dev
```

The development server runs at `http://localhost:3000`.

## Environment

```bash
SITE_URL=https://cortex-md.tech
CORTEX_SYNC_URL=https://api.cortex-md.tech
CORTEX_BILLING_RETURN_URL=https://cortex-md.tech/billing/cancelled
CORTEX_BILLING_COMPLETION_URL=cortex://sync/checkout-complete
CORTEX_DOWNLOAD_MACOS_URL=
CORTEX_DOWNLOAD_WINDOWS_URL=
CORTEX_DOWNLOAD_LINUX_URL=
```

`SITE_URL` defaults to `https://cortex-md.tech`. Download cards stay marked as `Soon` until their matching `CORTEX_DOWNLOAD_*_URL` value is configured.

## Vercel

Create the Vercel project from the monorepo root and set the project Root Directory to `apps/web`.

- Project name: `cortex-web`
- Framework preset: TanStack Start
- Install command: `cd ../.. && bun install --frozen-lockfile`
- Build command: `bun run build`
- Production domain: `https://cortex-md.tech`

Preview deployments are the default. Promote to production only after explicit approval.

## Product Media

Landing media uses `ProductMedia` with reserved dimensions, WebP sources where available, and lazy loading outside the hero. Only the hero media should use eager loading and high fetch priority.

## Validation

Run from the monorepo root:

```bash
bun run --cwd apps/web generate-routes
bun run --cwd apps/web check
bun run --cwd apps/web typecheck
bun run --cwd apps/web test
bun run --cwd apps/web build
bun run check:boundaries
```
