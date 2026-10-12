# AGENTS.md - @cortex/comments

`@cortex/comments` owns the portable business rules for note comments and `@[[Name]]` mentions.
Desktop, mobile, and core share it, so it must stay free of React, DOM, Node, Electron, and platform
imports (enforced by `bun run check:boundaries`).

## Responsibilities

- Comments never live inside the Markdown note. Each note has one sidecar at
  `.cortex/comments/<vault-relative note path>.json` (`commentsSidecarPath`,
  `notePathFromSidecar`). The sync policy in `@cortex/platform/sync-rules` always syncs that folder.
- `CommentsFile` is versioned (`version: 1`). Threads and messages are objects keyed by id, never
  arrays, so the sync engine's key-by-key JSON merge keeps concurrent replies from both sides.
- Authors and mentions store user ids only (`LOCAL_AUTHOR_ID` on local vaults); display names are
  resolved by the host at render time.
- `anchor.ts`: an anchor keeps `quote`, 32 characters of `prefix`/`suffix` context, and a `from`/`to`
  hint relative to the note body (frontmatter excluded). `resolveAnchor` tries the hint first, then
  the quote occurrence with the best context match nearest the hint, and returns `null` for orphaned
  threads. `anchorAtRange` rebuilds an anchor after the editor mapped it through edits.
- `mentions.ts`: one syntax for note bodies and comment text, `@[[Name]]` (`MENTION_PATTERN`,
  `formatMention`, `extractMentions`, `splitMentions`). Composers show `@Name` while typing:
  `toDisplayMentionText`, `findDisplayMentions` (member names only, so emails never match), and
  `toStoredMentionText` convert between the display form and the stored `@[[Name]]` form.
  `resolveMentionTargets` maps names to user ids; `filterMentionCandidates` ranks prefix matches
  before substring matches.
- `operations.ts`: pure, immutable mutations (`addThread`, `addReply` reopens a resolved thread,
  `setResolved`, `editMessage`/`deleteMessage` only for the author, soft delete that removes the
  thread once every message is deleted, `updateAnchors`), tolerant parsing
  (`parseCommentsFile`/`normalizeCommentsFile`), ordering (`sortThreadsByPosition` puts orphaned
  threads last), and `diffIncomingMessages`, which feeds mention and reply notifications.
- `createCommentId` does not rely on `crypto.randomUUID`, which Hermes may not provide.
