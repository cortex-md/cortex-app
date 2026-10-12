# AGENTS.md - @cortex/tasks

`@cortex/tasks` owns the portable business rules for tasks and reminders. Desktop, mobile, and the
Electron main process share it, so it must stay free of React, DOM, Node, Electron, and platform
imports (enforced by `bun run check:boundaries`).

## Responsibilities

- Tasks are Markdown checkboxes inside notes. The note text is the source of truth; this package
  never stores task state elsewhere.
- Inline syntax follows the Obsidian Tasks emoji format: `📅 YYYY-MM-DD [HH:MM]` due date and
  optional time, `⏰ [YYYY-MM-DD] HH:MM` absolute reminder (date omitted when it equals the due
  date), `🔁 every …` repeat, and `✅ YYYY-MM-DD` completion date.
- `parse.ts` is the single task-line parser for every surface (indexer, editor checkbox and toggle
  command, reading view, Electron main). It accepts list items inside blockquotes, skips frontmatter
  and CommonMark fenced code, and `applyTaskPatch` edits only the changed tokens in place: user
  spacing, unknown text, tags, and a trailing `^block-id` stay where they are. `locateTaskLine`
  re-finds a task after its file changed, ignoring lines inside code fences.
- `🔁` accepts `every [N] day|week|month|year [on the Nth] [when done]`. Completing a recurring task
  moves its due date to the first occurrence after today (`when done` counts from today).
- `actions.ts` holds line-level mutations shared by every surface: `toggleTaskLine` (recurring tasks
  advance their due date in place instead of being checked off), `snoozeTaskLine`, reminder preset
  resolution/detection, snooze targets, and `applyTaskNotificationAction`, which ignores stale
  notifications (task already done or its due date moved).
- `recurrence.ts` parses and formats `🔁` text and computes the next occurrence.
- `buckets.ts` groups tasks into Overdue, Today, Completed today, Upcoming, and Inbox.
- `quickAdd.ts` parses natural-language quick add input (today, tomorrow, weekdays, 12h/24h times,
  `every …`, `every month on the 5th`).
- `reminders.ts` plans OS notifications (`planReminders`) including quiet hours and the daily
  digest. Plans are absolute timestamps so any platform scheduler can replace its queue with them.
- Dates are local calendar dates (`YYYY-MM-DD`) and clock times (`HH:MM`); do not add date
  libraries.
