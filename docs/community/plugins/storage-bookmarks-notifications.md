# Storage, Bookmarks, and Notifications

## Plugin Data

Plugin data is vault-scoped under `<vault>/.cortex/plugins/<plugin-id>/data/`:

```ts
await ctx.data.write("cache.json", JSON.stringify({ lastRun: Date.now() }))
const cached = await ctx.data.read("cache.json")
await ctx.data.delete("cache.json")
```

Requires `data`. Filenames must not contain `..` or start with `/` or `\`. Use data files for
plugin-owned state; use vault APIs for user-visible notes. Settings are separate (see
[Views, settings, and UI](views-settings-and-ui.md)).

## Metadata

Requires `vault:read`:

```ts
const frontmatter = await ctx.metadata.getFrontmatter("Projects/Plan.md")
const tags = await ctx.metadata.getTags("Projects/Plan.md")
const allTags = ctx.metadata.getAllTags()
```

## Bookmarks

```ts
const bookmarks = ctx.bookmarks.list()
await ctx.bookmarks.toggle("Projects/Plan.md")
const isBookmarked = ctx.bookmarks.isBookmarked("Projects/Plan.md")
```

Reads require `bookmarks:read`; mutations require `bookmarks:write`. Paths are vault-relative
Markdown paths.

## Theme

```ts
const activeTheme = ctx.theme.getActiveThemeName()
ctx.theme.onThemeChange((name) => console.log("Theme changed", name))
```

Requires `theme:read`. Plugins observe the theme; they do not mutate it.

## Notifications and Notices

```ts
const result = await ctx.notifications.send({
	title: "Task complete",
	body: "Your plugin finished processing notes.",
	kind: "success",
})
if (!result.delivered) console.warn(result.reason)
```

Requires `notifications`; without it, `send` resolves `{ delivered: false, reason:
"missing-capability" }`. Plugins cannot request OS permission; Cortex owns prompts and platform
support. `ctx.ui.showNotice(message)` also requires `notifications`. Notifications are rate-limited
per plugin.
