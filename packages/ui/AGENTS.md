# @cortex/ui

## Color Contract

- Use `background`, `foreground`, `muted`, and `border` for neutral UI.
- Use `brand` only for accent actions, selection, and focus.
- Use `status-error-*`, `status-success-*`, and `status-warning-*` for feedback.
- Use `settings-group-*` only for Settings composition surfaces.
- Never hardcode white or Tailwind red, green, or yellow for semantic text and controls. Solid
  feedback fills use their matching `on-solid` token.

## Components

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
- Command surfaces expose `CommandFooter`, `CommandFooterHint`, and `CommandFooterKey` for compact
  keyboard hints. Keep them generic and presentational; feature-specific command behavior stays in
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
- `FolderPicker` uses `reserveDropdownSpace` when it is rendered inside an overflow-clipped
  Settings group so its inline option list remains visible.
- `FolderPicker` keeps its custom popup options as real buttons until it implements the full
  keyboard contract for ARIA listbox/combobox semantics.
- Settings composition remains desktop-owned. `@cortex/ui` provides `Field`, `Item`, `Separator`,
  and `NativeSelect` rather than a Settings-specific primitive.
- Exported variant helpers such as `buttonVariants` live in sibling non-component files
  (`button-variants.ts`, `toggle-variants.ts`, etc.). Component files should export components only
  so Fast Refresh boundaries stay clean while the root barrel keeps the public API stable.

## Performance

- Context provider values should be stable when they wrap interactive primitives.
- Prefer direct imports between UI primitives over package-barrel imports inside `@cortex/ui`.
- IconPicker must not load the full generated icon catalog when callers provide `iconsList`.
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
