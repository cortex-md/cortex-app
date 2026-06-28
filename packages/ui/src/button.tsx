import type { VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import type * as React from "react"
import { buttonVariants } from "./button-variants"
import { cn } from "./lib/utils"

function Button({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	type,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean
	}) {
	const Comp = asChild ? Slot.Root : "button"
	const buttonProps = asChild ? { ...props, type } : { ...props, type: type ?? "button" }

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={cn(buttonVariants({ variant, size, className }))}
			{...buttonProps}
		/>
	)
}

export { Button }
