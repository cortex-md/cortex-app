## Summary

What changed and why. Link the issue it closes (`Closes #123`).

## Checklist

- [ ] Validation for the areas I touched passes locally (see [CONTRIBUTING.md](../CONTRIBUTING.md#validation)):
      `bun run check`, `bun run typecheck`, `bun run check:boundaries`, `bun run test`
- [ ] Tests added or updated only where critical logic changed (sync, plugin loading, data integrity)
- [ ] Docs updated (`AGENTS.md`, `docs/`, website docs) when behavior, contracts or commands changed
- [ ] Screenshots or a short recording for UI changes (Paper and Ink themes)
- [ ] If a coding agent helped, I reviewed every change and ran the validation myself

## Notes for reviewers

Tradeoffs, follow-ups, or anything that needs extra attention.
