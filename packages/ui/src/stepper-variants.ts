import { cva } from "class-variance-authority"

const stepperItemVariants = cva(
	"inline-flex items-center gap-1.5 text-[12px] leading-none font-medium text-text-secondary",
	{
		variants: {
			state: {
				upcoming: "",
				current: "text-text-primary",
				done: "",
			},
		},
		defaultVariants: {
			state: "upcoming",
		},
	},
)

const stepperIndicatorVariants = cva(
	"inline-flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10px] leading-none font-semibold not-italic [&_svg]:size-2.5",
	{
		variants: {
			state: {
				upcoming: "bg-bg-hover",
				current: "bg-brand text-primary-foreground",
				done: "bg-status-success-background text-status-success-foreground",
			},
		},
		defaultVariants: {
			state: "upcoming",
		},
	},
)

export { stepperIndicatorVariants, stepperItemVariants }
