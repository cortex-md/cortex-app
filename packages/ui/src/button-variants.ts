import { cva } from "class-variance-authority"
import {
	nativeControlFocusRing,
	nativeHairlineRing,
	nativeQuietHover,
	nativeRaisedHover,
	nativeRaisedSurface,
} from "./lib/native-styles"

const buttonVariants = cva(
	[
		"inline-flex shrink-0 cursor-default items-center justify-center gap-1.5 rounded-[var(--control-pill-radius,999px)] border-0 text-[length:var(--control-font-size,14px)] font-medium leading-[var(--control-line-height,18px)] tracking-[-0.006em] whitespace-nowrap no-underline outline-none transition-[transform,background-color,color,box-shadow] duration-[120ms] ease-out",
		nativeControlFocusRing,
		"disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
		"active:scale-[0.97] motion-reduce:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
	],
	{
		variants: {
			variant: {
				default:
					"bg-brand text-primary-foreground shadow-[var(--shadow-primary,0_1px_2px_rgba(0,0,0,0.18))] hover:bg-brand-hover",
				destructive:
					"bg-status-error text-status-error-on-solid shadow-none hover:bg-[color-mix(in_srgb,var(--status-error)_88%,var(--text-primary))]",
				"destructive-soft":
					"bg-transparent text-status-error-foreground hover:bg-status-error-background",
				outline: ["bg-transparent text-text-primary", nativeHairlineRing, nativeQuietHover],
				secondary: ["text-text-primary", nativeRaisedSurface, nativeRaisedHover],
				ghost: [
					"bg-transparent text-text-secondary",
					nativeQuietHover,
					"active:bg-[var(--fill-quiet-strong,color-mix(in_srgb,var(--text-primary)_9%,transparent))] active:text-text-primary aria-expanded:bg-[var(--fill-quiet-strong,color-mix(in_srgb,var(--text-primary)_9%,transparent))] aria-expanded:text-text-primary aria-pressed:bg-[var(--fill-quiet-strong,color-mix(in_srgb,var(--text-primary)_9%,transparent))] aria-pressed:text-text-primary data-[state=open]:bg-[var(--fill-quiet-strong,color-mix(in_srgb,var(--text-primary)_9%,transparent))] data-[state=open]:text-text-primary",
				],
				link: "h-auto! rounded-[4px] p-0! text-brand-text underline-offset-[3px] hover:underline active:scale-100",
			},
			size: {
				default: "h-[var(--button-height-md,36px)] px-4 has-[>svg:first-child]:pl-3",
				xs: "h-[var(--button-height-xs,28px)] gap-[5px] px-[11px] text-[12.5px] has-[>svg:first-child]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
				sm: "h-[var(--button-height-sm,32px)] px-3.5 text-[13.5px] has-[>svg:first-child]:pl-2.5 [&_svg:not([class*='size-'])]:size-4",
				lg: "h-[var(--button-height-lg,44px)] px-[22px] text-[15px] has-[>svg:first-child]:pl-[17px] [&_svg:not([class*='size-'])]:size-5",
				"icon-xs":
					"size-[var(--button-height-xs,28px)] p-0 [&_svg:not([class*='size-'])]:size-[15px]",
				"icon-sm":
					"size-[var(--button-height-sm,32px)] p-0 [&_svg:not([class*='size-'])]:size-[17px]",
				icon: "size-[var(--button-height-md,36px)] p-0 [&_svg:not([class*='size-'])]:size-[18px]",
				"icon-lg": "size-[var(--button-height-lg,44px)] p-0 [&_svg:not([class*='size-'])]:size-5",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
)

export { buttonVariants }
