# @cortex/ui

## Color Contract

- Use `background`, `foreground`, `muted`, and `border` for neutral UI.
- Use `brand` only for the primary action, focus, links, and content markers. Hover, pressed,
  toggled-on and selected states use the neutral `fill-quiet`, `fill-quiet-strong` and
  `fill-selected` tokens; neutral controls sit on `surface-raised` with `shadow-raised`.
- New colour and size tokens are read through `var(--token, fallback)` in class strings so apps
  without the desktop token block (for example `apps/web`) still render correctly.
- Use `status-error-*`, `status-success-*`, and `status-warning-*` for feedback.
- Use `settings-group-*` only for Settings composition surfaces.
- Never hardcode white or Tailwind red, green, or yellow for semantic text and controls. Solid
  feedback fills use their matching `on-solid` token.

## Figma Mapping

Design file `ZTx4yLga2PKeyRIELjN2OS`, page **System Design** (`110:2`):

- `Native Reference` (`182:493`) keeps the Apple macOS kit instances as polish reference.
- `Cortex Components` (`182:497`) holds transcribed component sets bound to Cortex variables
  (`Cortex/Primitives`, `Cortex/Semantic Light`, `Cortex/Semantic Dark`).

| Primitive | Figma node |
|-----------|------------|
| `Button` | `184:442` |
| `Switch` | `184:457` |
| `Input` | `184:476` |
| `InputGroup` | `185:449` |
| `Checkbox` | `185:405` |
| `Label` | `185:406` |
| `Badge` | `185:420` |
| `Separator` | `185:423` |
| `NativeSelect` | `186:408` |
| `Slider` | `186:409` |
| `Tabs` | `186:427` |
| `ToggleGroup` | `186:428` |
| `ScrollArea` | `186:433` |
| `Dialog` | `188:394` |
| `AlertDialog` | `188:405` |
| `Command` | `188:414` |
| `Toaster` | `188:438` |

Full Apple-kit → primitive mapping lives in `CLAUDE.md`.

## Components

- `message.tsx` comes from the shadcn chat components (`shadcn add message`): `MessageGroup`,
  `Message`, `MessageAvatar`, `MessageContent`, `MessageHeader`, `MessageFooter`. Bubble and Message
  Scroller are intentionally not installed; comment threads render flat messages.

- Components remain pure primitives with class names and forwarded native props.
- Dialog primitives own shared modal chrome; use `DialogBody` for padded body regions when
  `DialogContent` is rendered with `p-0` and feature code needs flush headers or footers.
- Dialog and alert dialog content surfaces stay solid by default. Do not wire shared modal chrome to
  glass helpers or backdrop blur; platform-specific modal materials should use stable CSS hooks and
  tokens instead.
- Dialog and alert dialog overlays must sit below their content but above app chrome and popup
  layers so titlebars, editor text, and menu surfaces cannot bleed over modal text.
- Dialog and alert dialog content should not rely on a persistent centering transform. Center them
  with an untransformed fixed positioner so WebKit does not keep modal text on a transformed layer.
- Popup-like primitives (`Popover`, dropdown menus, select content, and context menus) use the
  shared solid popup surface with `data-popup-surface`; do not reintroduce strong translucency or
  backdrop blur for these default task surfaces.
- Overlay primitives share surface, item, and motion helpers from `lib/native-styles.ts`; keep
  `data-slot`, `data-popup-surface`, and `data-command-surface` stable so desktop CSS, plugins, and
  community themes can restyle overlays without component forks.
- High-use primitive geometry and typography should use public CSS variables with fallbacks instead
  of fixed arbitrary values when the rendered default can stay unchanged.
- Command surfaces expose `CommandFooterHints` (a `{ keys, label }[]` list) on top of
  `CommandFooter`, `CommandFooterHint`, and `CommandFooterKey` for compact keyboard hints. Keep them generic and presentational; feature-specific command behavior stays in
  desktop feature modules.
- Combobox-style primitives keep `aria-expanded` and `aria-controls` wired to their popup state.
- Prefer native semantic containers for listbox/list-like primitives. Do not add default generic
  `role="group"`/`role="list"` to visual wrappers unless the component can provide complete,
  named semantics.
- `AccordionTrigger` should keep the shadcn-style chevron affordance without custom icon shells or
  color-changing arrows; expand/collapse motion belongs in `AccordionContent`.
- Accordion trigger transitions must list explicit properties rather than using `transition-all`.
- Buttons use the accent with `primary-foreground`; custom accents update that foreground at
  runtime.
- Button primitives default native `<button>` rendering to `type="button"` while preserving explicit
  types and `asChild` behavior.
- `FolderPicker` renders its option list in a `Popover` portal anchored to the input, so it is never
  clipped by dialogs or overflow-hidden Settings groups and never pushes surrounding layout.
- `FolderPicker` keeps its custom popup options as real buttons until it implements the full
  keyboard contract for ARIA listbox/combobox semantics.
- `SidebarNav`, `SidebarNavGroup`, and `SidebarNavItem` are a static grouped navigation list for
  Settings-style layouts; they have no collapse state, cookies, or global shortcuts.
- Settings composition remains desktop-owned. `@cortex/ui` provides `Field`, `Item`, `Separator`,
  and `NativeSelect` rather than a Settings-specific primitive.
- Exported variant helpers such as `buttonVariants` live in sibling non-component files
  (`button-variants.ts`, `toggle-variants.ts`, etc.). Component files should export components only
  so Fast Refresh boundaries stay clean while the root barrel keeps the public API stable.

## Performance

- Context provider values should be stable when they wrap interactive primitives.
- Prefer direct imports between UI primitives over package-barrel imports inside `@cortex/ui`.
- `LucideIcon` renders names outside the static set from the lazy `lucide-lazy-icons` module; regenerate `lucide-icon-names.ts` and `lucide-lazy-icons.ts` with `node scripts/generate-lucide-icon-names.mjs` after upgrading `lucide-react`.
- Shared Lucide rendering should use dynamic icon imports and name normalization instead of an eager
  namespace map of all icon components.
- Avoid memo hooks that run before an early return when the computed content is cheap enough to
  derive inline.
- Ordered primitive slots without item identities, such as multi-thumb sliders, should use stable
  slot keys rather than array-index keys in JSX.
- Hooks that expose external browser state, such as viewport media queries, should use
  `useSyncExternalStore` with a server snapshot instead of initializing state in an effect.
- Do not keep heavy optional visualization wrappers in the root barrel when the desktop app does not
  use them. Add them back as a deliberate package/API decision, preferably behind a narrow subpath.

## Sheet

- `SheetContent` has two variants. `overlay` (default) is the shadcn modal drawer. `docked` renders
  without an overlay into a `container` element, so the panel sits in the layout (for example the
  database peek). Pair `docked` with `<Sheet modal={false}>` and prevent `onInteractOutside` when
  clicks elsewhere in the view should keep it open.

## Tag

- `Tag` is the inline value chip (`default | active`, optional `interactive`). Templates use the
  `active` variant for placeholder values such as "Today" or "Note name"; pass `onRemove` with a
  `removeLabel` to render the trailing remove button. CodeMirror widgets that need the same look
  reuse `tagVariants` instead of copying classes.

## StatusBadge

- `StatusBadge` is the single pill for colored status-like values (select options, database
  groups, board columns): 22px, dot plus label, tinted background from the option color
  (`gray | blue | green | red | amber | purple | pink | teal`, matching property option colors).
  Do not recreate option pills with feature CSS; pass `dot={false}` when the dot is not wanted.
