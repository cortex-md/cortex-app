export const nativeControlSurface =
	"border border-border/70 bg-background/80 shadow-none backdrop-blur-xl"

export const nativeGlassSurface =
	"border border-border/50 bg-popover/80 shadow-[0_8px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl"

export const nativeDialogSurface =
	"border border-border/50 bg-popover shadow-[0_8px_40px_rgba(0,0,0,0.12)]"

export const nativePopupSurface =
	"border border-border/35 bg-popover shadow-[0_10px_24px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)]"

export const nativeOverlayMotion =
	"duration-150 ease-out data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"

export const nativeDialogContentMotion =
	"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"

export const nativePopupContentMotion = nativeOverlayMotion

export const nativeMenuItemBase =
	"relative flex cursor-default items-center gap-2 rounded-[var(--popup-item-radius,6px)] px-2 py-1.5 text-[var(--control-font-size,13px)] leading-[var(--control-line-height,16px)] outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

export const nativeMenuItemFocus = "focus:bg-accent/70 focus:text-accent-foreground"

export const nativeMenuItemIcon = "[&_svg:not([class*='text-'])]:text-muted-foreground"

export const nativeMenuItemDestructive =
	"data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:*:[svg]:text-destructive!"

export const nativeTextFieldSurface = "border border-input-border bg-input-bg shadow-none"

export const nativeFocusRing =
	"focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"

export const nativeAccentFill = "bg-brand text-primary-foreground"

export const nativeAccentText = "text-brand"
