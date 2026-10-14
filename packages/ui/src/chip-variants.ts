import { cva } from "class-variance-authority"
import { nativeControlFocusRing } from "./lib/native-styles"

const chipVariants = cva(
	[
		"inline-flex shrink-0 cursor-default items-center gap-2 rounded-[var(--control-pill-radius,999px)] border-0 font-medium whitespace-nowrap text-text-primary outline-none transition-[transform,background-color,color,box-shadow] duration-[120ms] ease-out",
		nativeControlFocusRing,
		"disabled:pointer-events-none disabled:opacity-45 [&>svg]:pointer-events-none [&>svg]:shrink-0 [&>svg:not([class*='size-'])]:size-4 [&>svg:not([class*='text-'])]:text-text-secondary",
		"aria-pressed:bg-text-primary aria-pressed:text-bg-primary aria-pressed:shadow-none aria-pressed:[&>svg]:text-current",
	],
	{
		variants: {
			size: {
				default:
					"h-[var(--button-height-md,36px)] pr-4 pl-3.5 text-[14px] leading-[18px] has-[>[data-slot=chip-lead]]:pl-1.5",
				sm: "h-[var(--button-height-sm,32px)] pr-[13px] pl-3 text-[13.5px] leading-[18px] has-[>[data-slot=chip-lead]]:pl-[5px]",
			},
			surface: {
				raised:
					"bg-[var(--surface-raised,var(--bg-elevated))] shadow-[var(--shadow-raised)] hover:bg-[var(--surface-raised-hover,color-mix(in_srgb,var(--surface-raised,var(--bg-elevated))_96%,var(--text-primary)))]",
				floating:
					"bg-[var(--surface-raised,var(--bg-elevated))] shadow-[var(--shadow-floating-pill,var(--shadow-raised))] hover:bg-[var(--surface-raised-hover,color-mix(in_srgb,var(--surface-raised,var(--bg-elevated))_96%,var(--text-primary)))]",
				quiet:
					"bg-[var(--fill-quiet,color-mix(in_srgb,var(--text-primary)_5.5%,transparent))] shadow-none hover:bg-[var(--fill-quiet-strong,color-mix(in_srgb,var(--text-primary)_9%,transparent))]",
			},
		},
		defaultVariants: {
			size: "default",
			surface: "raised",
		},
	},
)

const chipLeadVariants = cva(
	"inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-subtle text-[11px] leading-none font-bold text-brand-text [&>img]:size-full [&>img]:object-cover",
	{
		variants: {
			size: {
				default: "size-[26px]",
				sm: "size-[22px]",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

export { chipLeadVariants, chipVariants }
