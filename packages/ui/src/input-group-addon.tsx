import type { VariantProps } from "class-variance-authority"
import type * as React from "react"
import { inputGroupAddonVariants } from "./input-group-variants"
import { cn } from "./lib/utils"

function InputGroupAddon({
	className,
	align = "inline-start",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
	return (
		<div
			data-slot="input-group-addon"
			data-align={align}
			className={cn(inputGroupAddonVariants({ align }), className)}
			onPointerDown={(e) => {
				if ((e.target as HTMLElement).closest("button")) {
					return
				}
				e.currentTarget.parentElement?.querySelector("input")?.focus()
			}}
			{...props}
		/>
	)
}

export { InputGroupAddon }
