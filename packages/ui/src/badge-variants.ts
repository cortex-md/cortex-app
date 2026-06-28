import { cva } from "class-variance-authority"
import { nativeAccentFill, nativeAccentText } from "./lib/native-styles"

const badgeVariants = cva(
	"inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[border-color,color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
	{
		variants: {
			variant: {
				default: [nativeAccentFill, "[a&]:hover:bg-brand-hover"],
				secondary: "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
				destructive:
					"bg-destructive text-status-error-on-solid focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
				outline:
					"border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
				ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
				link: [nativeAccentText, "underline-offset-4 [a&]:hover:underline"],
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
)

export { badgeVariants }
