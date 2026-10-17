import { cva } from "class-variance-authority"

const inputVariants = cva(
	"w-full min-w-0 rounded-[var(--control-radius,6px)] text-[length:var(--control-font-size,14px)] font-normal leading-[var(--control-line-height,18px)] outline-none transition-[background-color,border-color,color,box-shadow] selection:bg-brand selection:text-text-on-accent file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-[length:var(--control-font-size,14px)] file:font-medium file:text-foreground placeholder:text-text-muted disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
	{
		variants: {
			size: {
				sm: "h-[var(--control-height-sm,28px)] px-2.5 text-[13.5px]",
				default: "h-[var(--input-height-md,36px)] px-3",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

export { inputVariants }
