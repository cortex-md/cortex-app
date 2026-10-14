import { cva } from "class-variance-authority"
import {
	nativeQuietHover,
	nativeRaisedHover,
	nativeRaisedSurface,
	nativeToggleFocusRing,
} from "./lib/native-styles"

const toggleVariants = cva(
	[
		"inline-flex cursor-default items-center justify-center gap-1.5 rounded-[var(--control-pill-radius,999px)] border-0 text-[14px] font-medium leading-[18px] whitespace-nowrap text-text-secondary outline-none transition-[background-color,color,box-shadow] duration-[120ms] ease-out has-[>svg:only-child]:px-0",
		nativeToggleFocusRing,
		"disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
	],
	{
		variants: {
			variant: {
				default: [
					"bg-transparent",
					nativeQuietHover,
					"data-[state=on]:bg-[var(--fill-quiet-strong,color-mix(in_srgb,var(--text-primary)_9%,transparent))] data-[state=on]:text-text-primary",
				],
				outline: [
					"px-3.5 text-text-primary",
					nativeRaisedSurface,
					nativeRaisedHover,
					"data-[state=on]:bg-text-primary data-[state=on]:text-bg-primary data-[state=on]:shadow-none",
				],
			},
			size: {
				default: "h-[var(--button-height-sm,32px)] min-w-[var(--button-height-sm,32px)] px-2.5",
				sm: "h-[var(--button-height-xs,28px)] min-w-[var(--button-height-xs,28px)] px-2 text-[13.5px] [&_svg:not([class*='size-'])]:size-4",
				lg: "h-[var(--button-height-lg,44px)] min-w-[var(--button-height-lg,44px)] px-3.5",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
)

export { toggleVariants }
