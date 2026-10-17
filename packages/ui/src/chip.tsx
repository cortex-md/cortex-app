import type * as React from "react"
import { chipLeadVariants, chipVariants } from "./chip-variants"
import { cn } from "./lib/utils"

type ChipProps = React.ComponentProps<"button"> & {
	size?: "default" | "sm"
	pressed?: boolean
	floating?: boolean
	quiet?: boolean
	lead?: React.ReactNode
}

function Chip({
	className,
	size = "default",
	pressed,
	floating = false,
	quiet = false,
	lead,
	type,
	children,
	...props
}: ChipProps) {
	const surface = quiet ? "quiet" : floating ? "floating" : "raised"
	const leadNode =
		lead === undefined || lead === null ? null : (
			<span data-slot="chip-lead" className={chipLeadVariants({ size })}>
				{lead}
			</span>
		)

	return (
		<button
			data-slot="chip"
			data-size={size}
			type={type ?? "button"}
			aria-pressed={pressed}
			className={cn(chipVariants({ size, surface }), className)}
			{...props}
		>
			{leadNode}
			{children}
		</button>
	)
}

export type { ChipProps }
export { Chip }
