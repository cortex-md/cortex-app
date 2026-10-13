import { cva } from "class-variance-authority"

const tagVariants = cva(
	"inline-flex h-5 max-w-full shrink-0 items-center gap-1 rounded-[5px] border px-1.5 align-baseline text-[12.5px] leading-none font-medium whitespace-nowrap transition-[background-color,border-color,color] [&>svg]:pointer-events-none [&>svg]:size-3",
	{
		variants: {
			variant: {
				default: "border-border bg-muted text-muted-foreground",
				active: "border-transparent bg-brand-subtle text-brand-text",
			},
			interactive: {
				true: "hover:border-brand/50 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
				false: "",
			},
		},
		defaultVariants: {
			variant: "default",
			interactive: false,
		},
	},
)

const tagRemoveButtonClassName =
	"-mr-0.5 inline-flex size-3.5 items-center justify-center rounded-[3px] opacity-70 hover:bg-current/15 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none [&>svg]:size-3"

export { tagRemoveButtonClassName, tagVariants }
