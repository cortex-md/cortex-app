# @cortex/properties

- Own property definitions, validation, YAML frontmatter mutations, vault schema persistence,
  suggestions, author resolution, system metadata, and per-note property UI state.
- Keep the root package framework-free and platform-agnostic. Platform access is injected through
  `initializeProperties`.
- Runtime services are separated into `files`, `notes`, `identity`, and `metadata`. Keep service
  methods narrow and batch note presentation through `loadNotePropertiesSnapshot`.
- When a caller already has the current raw note from `NoteCache`, pass it to
  `loadNotePropertiesSnapshot` instead of asking the runtime to read the note again.
- Note-opening callers should prefer `projectRawNote` and pass the resulting projection to
  `loadNotePropertiesSnapshot` so body extraction, persisted meta, and malformed-frontmatter state
  are derived once per raw note version.
- Keep pure definition factories and transformations in `definitions.ts`, value parsing and
  coercion in `values.ts`, actor resolution in `actors.ts`, persistence in `schemaStore.ts` and
  `noteStore.ts`, and vault discovery under `discovery/`.
- Test-only runtimes and definitions live under `src/__tests__/fixtures`; never expose them from the
  production package.
- Keep discovery helpers local unless they are part of the root package API; avoid exporting
  implementation details from production modules.
- Shared schema reading belongs in `schemaPersistence.ts` when both schema writes and discovery
  need it; avoid making discovery import the writer/listener module.
- Treat platform "missing file" and "missing parent directory" errors as an empty vault schema.
  Mobile adapters may report `Directory does not exist`, `File does not exist`, or `Path does not
  exist` for a fresh `.cortex/schema` folder.
- Keep CodeMirror integration isolated to the `@cortex/properties/codemirror` subpath. Production
  value imports there must be dynamic so the desktop shell does not load CodeMirror before an
  editable surface needs it.
- CodeMirror runtime contracts in that subpath may use type-only imports and `typeof import(...)`
  module shapes, but must not add eager value imports.
- Note CodeMirror documents contain only Markdown bodies. The CodeMirror subpath stores structured
  frontmatter metadata through state effects and must not hide, replace, or protect raw YAML ranges.
- Preserve unknown YAML keys, comments, ordering, scalar types, and line endings during targeted
  property mutations.
- `extractFrontmatterBody` and `replaceFrontmatterBody` preserve the complete frontmatter prefix
  byte-for-byte, including malformed YAML, while body editing remains available.
- Property keys are immutable after creation. Property names are editable display labels.
- `select` owns stable UUID options, token color keys, optional defaults, and persisted manual or
  alphabetical ordering. Legacy unavailable types remain readable and preserved.
- `tags` is a built-in primitive backed by the YAML `tags` array. Empty arrays are empty property
  values and should remove the field rather than persisting `tags: []`.
- New-note defaults stay minimal: creation time may be initialized when the vault schema defines it,
  but IDs, actors, last-edited fields, and select defaults must not be auto-created.
- `person` stores one remote user ID and resolves to free text for local vaults. System actors use
  the same member and device identity resolution without persisting display labels.
- Schema and UI-state writes must use the injected atomic writer.
- Per-note property UI-state path helpers must stay prefix-aware: folder renames, moves, and
  deletes migrate or remove descendant note entries along with the exact note path.
- Unavailable custom property types remain readable and preserved, but cannot be edited.
- Note rendering and panel refreshes must never build the vault-wide suggestion index. Derive
  unknown scalar keys from the current `PropertyMap`; build global suggestions only while Add
  Property is open.
- Suggestion indexing is single-flight per vault. Query changes share the active build, invalidation
  only increments its generation, and an invalidation during a build permits one serialized rebuild.
- Suggestion indexing may read independent notes concurrently, but keep note reads bounded and merge
  compact observed property entries into the index afterward. Keep generation checks after awaited
  builds so stale results are never published.
- Bounded suggestion readers should use `Promise.all` worker pools without `await` inside loops so
  performance diagnostics continue to distinguish intentional limits from accidental waterfalls.
- `listMarkdownFiles` consumes the file list already loaded by the host vault store. It must not
  trigger another vault scan.
- Schema writes and synced schema replacements notify `onVaultSchemaChange` subscribers without a
  React dependency.
- Panel presentation rules are framework-free: `getVisiblePropertyDefinitions`/
  `getHiddenPropertyDefinitions` (including the virtual `TAGS_PROPERTY_DEFINITION`) decide which rows
  show, and `resolveTextPropertyDraft`/`getPropertyInputType` own text draft parsing, validation, and
  input kinds. Desktop and mobile editors must not duplicate that commit logic.
- `@cortex/properties/frontmatter` is the dependency-light subpath for frontmatter parsing used by
  `@cortex/renderer`; it is the only YAML frontmatter parser in the repo.
- The properties runtime adapter (`initializeCoreProperties`) lives in `@cortex/core`; apps must not
  build their own `PropertiesRuntime` objects.

## Multiple Values, Empty Visibility, and Links

- `PropertyDefinition.multiple` stores select and person values as arrays; use
  `allowsMultipleValues`, `getPropertyValueList`, and `togglePropertyValue` instead of branching on
  value shape in UI code. `setProperty` validates each item.
- `PropertyDefinition.hideWhenEmpty` hides a property with an empty value unless the user revealed it.
- `getPropertyValueHref` turns URL, email, and phone values into `https:`, `mailto:`, and `tel:`
  links. `getPropertyValueUsage(vaultPath, key)` reports how many notes use a property and each value.

## Databases

- `@cortex/properties/database` is the portable database engine shared by desktop and mobile. It
  may import only properties internals, `yaml`, and `zod`: no DOM, React, `crypto`, or `node:`.
- A database is a folder whose folder note (`Folder/Folder.md`) has a `database` frontmatter key.
  Rows are the folder's direct Markdown children, excluding that note. Use `paths.ts` helpers.
- `detectDatabaseNote` and `normalizeDatabaseConfig` never throw. Malformed or conflicted YAML keeps
  the note detected with a default table view and an `error`, so rows stay visible.
- `serializeDatabaseConfig` writes block-style YAML in a fixed key order and omits empty fields so
  line-based sync merges stay clean. View ids are deterministic (`table`, `table-2`); never store
  timestamps or UI state (active view, collapsed groups, search) in the config.
- Property names, types, and select options stay in the vault schema. Filters and board columns use
  select option ids, never labels. `$me`/`$today` tokens resolve from an injected
  `DatabaseQueryContext`; the engine never reads clocks or identity.
- Presets (`buildDatabaseFromPreset`) reuse existing schema keys case-insensitively before creating
  definitions. Row templates live in `config.templates`, not `.cortex/templates`, so they sync.
- The `database` key is excluded from observed and visible property rows.
- Manual order is `view.order` (row titles); `sortDatabaseRows` applies it after explicit sorts and
  before the title tie-break. `renameDatabaseOrderEntry` keeps it in step with row renames.
- Date comparisons and calendar buckets go through `readDatabaseDate`, which maps ISO timestamps
  (`created_time`, `last_edited_time`) to the local calendar day. Read-only property types are never
  written by presets, board moves, or calendar moves (`isDatabasePropertyReadOnly`).
- Note writes go through `notes.updateNote(path, transform)`; the host serializes them per path.

- `createDatabasePresetFromConfig` and `parseDatabasePreset` are the shareable database template
  format; presets may carry `rowTemplates`, which `buildDatabaseFromPreset` writes to
  `config.templates` with remapped property keys.
