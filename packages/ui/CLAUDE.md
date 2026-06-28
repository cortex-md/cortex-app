# CLAUDE.md — @cortex/ui

This file provides guidance to Claude Code (claude.ai/code) when working with UI components in the Cortex design system.

## Purpose

`@cortex/ui` exports **primitive UI components** that:
- Are framework-agnostic building blocks (work on desktop app + future web landing page)
- Apply CSS class names (never inline styles)
- Have no business logic, no state, no store dependencies
- Extend native HTML element attributes for full DOM access
- Are consistently styled via the design system in `apps/desktop/src/styles.css`

## Component Contract

All components follow this pattern:

```typescript
import type { [HTMLElement]HTMLAttributes, ReactNode } from "react"

interface Props extends [HTMLElement]HTMLAttributes<HTML[Element]> {
  // Add optional variant/size/state props
  variant?: "primary" | "secondary"
  size?: "sm" | "md" | "lg"
  disabled?: boolean
  children?: ReactNode
  // Any other custom props
}

export function ComponentName({
  variant = "secondary",
  size = "md",
  className = "",
  // Spread and destruct all HTML attributes
  ...rest
}: Props) {
  return (
    <[element]
      className={`component-root component-${variant} component-${size} ${className}`}
      {...rest}
    >
      {/* Content */}
    </[element]>
  )
}
```

## Key Principles

### Native macOS Reference Mapping
This package uses the Figma file `ZTx4yLga2PKeyRIELjN2OS`, frame `110:2`, as the native-feel reference for macOS polish. The selected reference nodes map to primitives this way:

| Figma node | `@cortex/ui` primitive |
|------------|------------------------|
| `Switch` (`112:3425`, `112:3426`) | `Switch` |
| `Window/Search` (`112:3427`) | `InputGroup variant="search"` with `InputGroupInput` |
| `Window/Pop-Up Button` (`112:3428`) | `NativeSelect`, `SelectTrigger` |
| `Window/Segmented Control` (`112:3429`) | `TabsList`/`TabsTrigger`, `ToggleGroup` |
| `Text Field` (`112:3430`) | `Input`, `Textarea`, default `InputGroup` |
| `Slider` (`112:3431`, `112:3432`) | `Slider` |
| `Example`, `Small` (`112:3433`, `112:3436`) | `Sidebar`, `Card`, dialog/panel surfaces |
| `Scrollbar - Vertical` (`112:3434`) | `ScrollArea`, `ScrollBar` |
| `Notification` (`112:3435`) | `Toaster` |
| `Push Button` (`112:3437`) | `Button size="xs"` and default button treatment |
| `Alert` (`112:3438`) | `AlertDialog` |

Native-feel rules for this package:
- `Button` defaults to the prominent accent action: 28px high, pill-shaped, and backed by
  `brand`/`brand-hover`. Use `secondary`, `outline`, or `ghost` for neutral actions.
- `Switch` defaults to the 54×24 macOS content-area size. Its thumb grows horizontally while
  pressed and returns through the same transition after a quick click. The default thumb is a
  32×20 capsule with 2px vertical clearance; `size="sm"` is the compact 32×18 track.
- `Slider` uses a 29px interaction area, a 3px track, and one 20px glass thumb by default.
- Search fields with icons use `InputGroup variant="search"`, `InputGroupAddon`, and
  `InputGroupInput`. Feature code must not recreate icon positioning, capsule material, or focus
  treatment.
- `Input` and `InputGroup` use solid `input-bg` and `input-border` surfaces. Their default 32px
  text-field size is for forms and Settings; use `size="sm"` for the 24px Apple compact field.
- Use 6px radius for text fields and compact controls; use full pills only for search, pop-up, segmented controls, and switches.
- Use 13px control typography with 16px line height for compact macOS controls.
- Prefer transparent or token-backed material surfaces that the app layer can place over real vibrancy.
- Treat `Switch` as the thumb/track control. `Toggle` is the pressed-button primitive and should not inherit switch sizing or thumb behavior.
- Use the user's accent tokens for selected control state: `brand`, `brand-hover`, `brand-subtle`, `brand-text`, and `text-text-on-accent`. Do not hardcode Apple green/blue, and do not use `primary` when the semantic meaning is "current accent".
- Neutral UI uses `background`, `foreground`, `muted`, and `border`. Semantic feedback uses
  `status-error-*`, `status-success-*`, and `status-warning-*`; solid fills use the corresponding
  `on-solid` foreground. Settings composition may use `settings-group-*`.
- Primary buttons use `brand` with the adaptive `primary-foreground`. Never force white text over a
  configurable accent.
- `SidebarProvider` accepts `platform?: "macos" | "windows" | "linux"` and otherwise reads `document.body[data-platform]`. macOS sidebars use translucent material-like surfaces and compact rows; Windows sidebars use opaque surfaces, clear dividers, and an accent rail for active rows.
- Do not add `cursor-pointer` to rows, buttons, tabs, menu items, or sidebar items. Keep text cursors only for text-entry affordances and resize cursors only for resize rails.
- Avoid broad web elevation. Use native material surfaces and subtle borders instead of generic `shadow-xs`, `shadow-sm`, or `shadow-lg`.
- Avoid broad `transition-all` and smooth scrolling in primitives.

### 1. Extend HTML Attributes
Always extend the corresponding HTML attribute interface:

```typescript
// ✅ CORRECT
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary"
  children: ReactNode
}

// ❌ WRONG
interface Props {
  onClick?: () => void
  className?: string
  variant?: "primary" | "secondary"
}
```

This ensures full native element support (accessibility attributes, data-*, event handlers, etc.).

### 2. CSS Classes Only
Components apply **CSS class names**, never inline `style` props:

```typescript
// ✅ CORRECT
<button className={`btn btn-${variant} btn-${size} ${className}`}>

// ❌ WRONG
<button style={{ backgroundColor: color, padding: `${padding}px` }}>
```

All styling is defined in `apps/desktop/src/styles.css` via:
- `:root` variables (primitives: colors, spacing, shadows)
- `.btn` base class
- `.btn-primary`, `.btn-secondary`, etc. (variants)
- `.btn-sm`, `.btn-md`, `.btn-lg` (sizes)

### 3. Spread Remaining Props
Always use `...rest` to forward all remaining HTML attributes:

```typescript
export function Input({ error, icon, className = "", ...rest }: Props) {
  return <input className={`input ${error ? "input-error" : ""} ${className}`} {...rest} />
}
```

This allows consumers to add `id`, `data-*`, `aria-*`, event handlers, etc.

### 4. Optional className Override
Always accept an optional `className` prop so consumers can add extra classes for layout:

```typescript
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string  // This allows: <Button className="mt-4 ml-2" />
}
```

Merge with component classes: `className={`btn btn-${variant} ${className}`}`

### 5. No Default onClick, No State
Components are **dumb** — they don't manage their own state or business logic:

```typescript
// ✅ CORRECT: Consumer handles state
export function Toggle({ checked, onChange, ...rest }: Props) {
  return (
    <button
      className={`toggle ${checked ? "toggle-on" : "toggle-off"}`}
      onClick={(e) => onChange?.(!checked)}
      {...rest}
    />
  )
}

// ❌ WRONG: Component manages internal state
export function Toggle(props: Props) {
  const [checked, setChecked] = useState(false)
  // ...
}
```

### 6. Variant & Size as Enums (via Union Types)
Use union types for variants and sizes:

```typescript
type Variant = "primary" | "secondary" | "ghost" | "danger"
type Size = "sm" | "md" | "lg"

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}
```

This provides clear documentation and IDE autocomplete.

### 7. Optional Props with Sensible Defaults
Provide reasonable defaults:

```typescript
export function Button({
  variant = "secondary",      // Default variant
  size = "md",                // Default size
  type = "button",            // Type defaults to "button" not "submit"
  className = "",
  children,
  ...rest
}: Props) {
  // ...
}
```

### 8. Icon Props via ReactNode
For components that accept icons (e.g., Button with leading/trailing icon), use `ReactNode`:

```typescript
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode         // Icon is a React element
  iconPosition?: "left" | "right"
  children: ReactNode
}

export function Button({
  icon,
  iconPosition = "left",
  children,
  ...rest
}: Props) {
  if (!icon) return <button>{children}</button>

  return (
    <button {...rest}>
      {iconPosition === "left" && icon}
      {children}
      {iconPosition === "right" && icon}
    </button>
  )
}
```

## Component Checklist

Before creating or modifying a component, ensure:

- [ ] Extends correct `HTMLElement`HTMLAttributes interface
- [ ] Uses union types for variants/sizes
- [ ] Has sensible default prop values
- [ ] Applies classes via `className={`...`}`, not `style`
- [ ] Spreads `...rest` to forward all attributes
- [ ] Accepts optional `className` prop for consumer customization
- [ ] No internal state (useState/useReducer/useContext)
- [ ] No direct store dependencies
- [ ] No network requests or side effects
- [ ] Exports from `packages/ui/src/index.ts`
- [ ] Styled via CSS classes (not inline styles)
- [ ] Props interface is well-documented

## Existing Components

| Component | Purpose | Props |
|-----------|---------|-------|
| **Button** | Action button with variants (primary, secondary, ghost, danger, accent) and sizes (sm, md, lg) | `variant`, `size`, `className`, HTML attrs |
| **Input** | Text input with optional error state and icon | `error`, `icon`, HTML attrs |
| **Toggle** | Toggle switch for boolean states | `checked`, `onChange` callback, HTML attrs |
| **SplitPane** | Resizable two-pane splitter (horizontal or vertical) | `direction`, `sizes`, `onResize`, children |
| **TabBar** | Horizontal tab list with active indicator | `tabs`, `activeId`, `onSelect` |
| **StatusBar** | Bottom status bar with left/center/right sections | `left`, `center`, `right` (ReactNode) |
| **FolderPicker** | Searchable dropdown for selecting a vault folder/file path | `options`, `value`, `onChange`, `placeholder` |

## Adding a New Component

1. **Create the file**: `packages/ui/src/ComponentName.tsx`
2. **Define props interface**: Extend HTML attributes
3. **Implement component**: Apply CSS classes, spread props, no state
4. **Export from index**: Add to `packages/ui/src/index.ts`
5. **Add CSS**: Define styles in `apps/desktop/src/styles.css`
6. **Test in app**: Import and use in `apps/desktop/src/features/**`, `components/shared/**`, or
   `App.tsx`

Example: New Badge component

```typescript
// packages/ui/src/Badge.tsx
import type { HTMLAttributes, ReactNode } from "react"

type Variant = "success" | "warning" | "error" | "info" | "neutral"

interface Props extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
  size?: "sm" | "md" | "lg"
  children: ReactNode
}

export function Badge({
  variant = "neutral",
  size = "md",
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <span
      className={`badge badge-${variant} badge-${size} ${className}`}
      {...rest}
    >
      {children}
    </span>
  )
}
```

Then add to `index.ts`:
```typescript
export { Badge } from "./Badge"
```

And style in `apps/desktop/src/styles.css`:
```css
.badge {
  display: inline-block;
  font-size: var(--font-size-sm);
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.badge-success { background-color: var(--success-bg); color: var(--color-success); }
.badge-warning { background-color: var(--warning-bg); color: var(--color-warning); }
/* ... etc */
```

## Design System CSS Variables

All styling uses CSS variables from `apps/desktop/src/styles.css`:

```css
:root {
  /* Colors */
  --stone-50: #fafaf8;
  --stone-100: #f5f4f0;
  /* ... */

  /* Semantic */
  --bg-primary: var(--stone-50);
  --text-primary: var(--stone-900);
  --accent: var(--amber-400);
  /* ... */

  /* Component-specific */
  --btn-primary-bg: var(--ink-100);
  --input-border: var(--stone-300);
  /* ... */
}
```

Use these in component CSS:
```css
.button {
  background-color: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border: 1px solid var(--border);
}
```

## No Dependencies Beyond React & Lucide

- ✅ React (peer dependency)
- ✅ Lucide React (for icons)
- ❌ No UI libraries (Headless UI, Radix, etc.)
- ❌ No state management
- ❌ No HTTP clients

Keep components **minimal and portable**.

## Building & Testing

```bash
# Type check this package
bun run typecheck

# Lint & format
bun run check
bun run check:fix

# Import in desktop app
import { Button } from "@cortex/ui"
```

Components are used directly in `apps/desktop/src/` via the workspace import. No separate build step for development.

## Consistency Across Web & Desktop

Because these components are primitives:
- They can be used in the desktop app (`apps/desktop`)
- They can be used in a future web landing page
- Styling is consistent everywhere (CSS variables)
- Platform feel is selected through props or `data-platform` attributes, not native APIs
- No Tauri or React Native dependencies

This ensures the design system is a single source of truth.
