import { cva } from "class-variance-authority"
import { nativeAccentText, nativeFocusRing } from "./lib/native-styles"

const buttonVariants = cva(
	[
		"inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[var(--control-pill-radius,999px)] text-[var(--control-font-size,13px)] font-normal leading-[var(--control-line-height,16px)] tracking-[-0.01em] whitespace-nowrap outline-none transition-[transform,background-color,border-color,color,box-shadow,opacity,filter] duration-150 ease-out",
		nativeFocusRing,
		"disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
		"active:scale-[0.97] active:brightness-[0.97] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
	],
	{
		variants: {
			variant: {
				default:
					"border border-white/20 bg-brand text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_1px_2px_rgba(0,0,0,0.14)] hover:bg-brand-hover",
				destructive:
					"border border-status-error-border bg-destructive text-status-error-on-solid shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.14)] hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
				outline:
					"border border-border/60 bg-background/65 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-xl hover:bg-accent/70 hover:text-accent-foreground dark:border-white/10 dark:bg-input/25 dark:hover:bg-input/45",
				secondary:
					"border border-border/40 bg-secondary/75 text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl hover:bg-secondary",
				ghost: "hover:bg-accent/70 hover:text-accent-foreground dark:hover:bg-accent/50",
				link: [nativeAccentText, "underline-offset-4 hover:underline"],
			},
			size: {
				default: "h-[var(--button-height-md,var(--control-height-md,28px))] px-3 has-[>svg]:px-2.5",
				xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-8 px-3.5 has-[>svg]:px-3",
				lg: "h-10 px-5 text-[15px] has-[>svg]:px-4",
				icon: "size-7",
				"icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "size-8",
				"icon-lg": "size-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
)

export { buttonVariants }
