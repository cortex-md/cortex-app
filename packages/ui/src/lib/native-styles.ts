export const nativeControlSurface =
	"border border-border/70 bg-background/80 shadow-none backdrop-blur-xl"

export const nativeGlassSurface =
	"border border-border/50 bg-popover/80 shadow-[0_8px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl"

export const nativeDialogSurface =
	"border border-border/50 bg-popover shadow-[0_8px_40px_rgba(0,0,0,0.12)]"

export const nativePopupSurface =
	"border-0 bg-[var(--surface-raised,var(--popover))] shadow-[var(--shadow-floating-pill,0_10px_24px_rgba(0,0,0,0.12))]"

export const nativeOverlayMotion =
	"duration-150 ease-out data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"

export const nativeDialogContentMotion =
	"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"

export const nativeCommandSurfaceMotion =
	"duration-100 ease-out data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"

export const nativeCommandSurface =
	"border border-border/50 bg-popover shadow-[0_10px_24px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)]"

export const nativePopupContentMotion = nativeOverlayMotion

export const nativeMenuItemBase =
	"relative flex min-h-[34px] cursor-default items-center gap-2.5 rounded-[var(--popup-item-radius,6px)] px-2.5 py-[7px] text-[length:var(--control-font-size,14px)] leading-[var(--control-line-height,18px)] font-normal outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]"

export const nativeMenuItemFocus =
	"focus:bg-[var(--fill-quiet-strong,color-mix(in_srgb,var(--text-primary)_9%,transparent))] focus:text-text-primary"

export const nativeMenuLabel = "px-2.5 pt-2 pb-1.5 text-xs leading-4 font-medium"

export const nativeMenuShortcut = "ml-auto text-[12.5px] tracking-widest text-muted-foreground"

export const nativeMenuItemIcon = "[&_svg:not([class*='text-'])]:text-muted-foreground"

export const nativeMenuItemDestructive =
	"data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:*:[svg]:text-destructive!"

export const nativeTextFieldSurface = "border border-input-border bg-input-bg shadow-none"

export const nativeFocusRing =
	"focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"

export const nativeControlFocusRing =
	"focus-visible:shadow-[0_0_0_2px_var(--bg-primary),0_0_0_4px_color-mix(in_srgb,var(--border-focus)_55%,transparent)]"

export const nativeToggleFocusRing =
	"focus-visible:shadow-[0_0_0_2px_color-mix(in_srgb,var(--border-focus)_55%,transparent)]"

export const nativeRaisedSurface =
	"bg-[var(--surface-raised,var(--bg-elevated))] shadow-[var(--shadow-raised)]"

export const nativeRaisedHover =
	"hover:bg-[var(--surface-raised-hover,color-mix(in_srgb,var(--surface-raised,var(--bg-elevated))_96%,var(--text-primary)))]"

export const nativeQuietFill =
	"bg-[var(--fill-quiet,color-mix(in_srgb,var(--text-primary)_5.5%,transparent))]"

export const nativeQuietHover =
	"hover:bg-[var(--fill-quiet,color-mix(in_srgb,var(--text-primary)_5.5%,transparent))] hover:text-text-primary"

export const nativeQuietStrongFill =
	"bg-[var(--fill-quiet-strong,color-mix(in_srgb,var(--text-primary)_9%,transparent))]"

export const nativeHairlineRing =
	"shadow-[inset_0_0_0_1px_var(--hairline,color-mix(in_srgb,var(--text-primary)_10%,transparent))]"

export const nativeInverseFill = "bg-text-primary text-bg-primary shadow-none"

export const nativeAccentFill = "bg-brand text-primary-foreground"

export const nativeAccentText = "text-brand"
