import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"
import { nativeControlSurface } from "./lib/native-styles"
import { cn } from "./lib/utils"

const alertVariants = cva(
	[
		"relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-[10px] px-4 py-3 text-[13px] has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
		nativeControlSurface,
	],
	{
		variants: {
			variant: {
				default: "text-card-foreground",
				destructive:
					"text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
)

function Alert({
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div
			data-slot="alert"
			role="alert"
			className={cn(alertVariants({ variant }), className)}
			{...props}
		/>
	)
}

export { Alert }
