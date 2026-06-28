import type { VariantProps } from "class-variance-authority"
import type * as React from "react"
import { inputGroupVariants } from "./input-group-variants"
import { cn } from "./lib/utils"

function InputGroup({
	className,
	variant = "default",
	size = "default",
	role,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupVariants>) {
	const groupRole = role ?? (ariaLabel || ariaLabelledBy ? "group" : undefined)
	const accessibilityProps = groupRole
		? { role: groupRole, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy }
		: {}

	return (
		<div
			data-slot="input-group"
			data-variant={variant}
			data-size={size}
			{...accessibilityProps}
			className={cn(
				inputGroupVariants({ variant, size }),
				"has-[>textarea]:h-auto",
				"has-[>[data-align=inline-start]]:[&>input]:pl-2",
				"has-[>[data-align=inline-end]]:[&>input]:pr-2",
				"has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3",
				"has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3",
				"has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/40",
				"has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-destructive/20 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40",
				className,
			)}
			{...props}
		/>
	)
}

export { InputGroup }
