import { cva } from "class-variance-authority"

const radioGroupItemVariants = cva(
	"aspect-square size-4 shrink-0 rounded-full bg-transparent shadow-[inset_0_0_0_1.5px_var(--border-strong)] outline-none transition-[box-shadow,opacity] duration-150 ease-out disabled:opacity-50 data-[state=checked]:shadow-[inset_0_0_0_5px_var(--accent)]",
)

const radioCardVariants = cva(
	"group/radio-card flex w-full items-center gap-3 rounded-[10px] border-0 bg-transparent px-3 py-2.5 text-left text-foreground outline-none transition-[background-color,opacity] duration-100 hover:bg-[var(--fill-quiet,color-mix(in_srgb,var(--text-primary)_5.5%,transparent))] focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=checked]:bg-[var(--fill-selected,color-mix(in_srgb,var(--text-primary)_7%,transparent))] data-[disabled]:opacity-50 data-[disabled]:hover:bg-transparent",
	{
		variants: {
			size: {
				default: "",
				lg: "gap-3.5 rounded-xl p-3.5",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

const radioCardMediaVariants = cva(
	"inline-flex shrink-0 items-center justify-center bg-bg-hover text-text-secondary [&_svg:not([class*='size-'])]:size-[15px]",
	{
		variants: {
			size: {
				default: "size-[30px] rounded-lg",
				lg: "size-9 rounded-[10px]",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

export { radioCardMediaVariants, radioCardVariants, radioGroupItemVariants }
