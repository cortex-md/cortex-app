# CLAUDE.md

This repository keeps Codex-facing guidance in `AGENTS.md`. Claude Code agents should read the root
`AGENTS.md` first, then the nearest package `AGENTS.md` when one exists.

Use this file only as a compatibility pointer so `CLAUDE.md` does not drift into a second copy of
the project manual. If a package has only `CLAUDE.md`, treat it as package-local guidance until an
`AGENTS.md` equivalent is added.

## Repository Rules

- Cortex is a desktop-first Tauri app with reusable TypeScript packages, not a web-only project.
- Respect package ownership and dependency boundaries before moving code.
- Use `@cortex/ui` primitives for UI, `@cortex/platform` for platform access, and
  `@cortex/commands` for command surfaces.
- Keep CodeMirror value imports behind the `@cortex/editor` lazy runtime loader in production code.
- Keep frontmatter outside CodeMirror documents; `@cortex/properties` owns structured metadata.
- Run the validations listed in `AGENTS.md` for the area you changed.
