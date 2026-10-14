import type * as React from "react"
import { nativeRaisedSurface } from "./lib/native-styles"
import { cn } from "./lib/utils"

function ButtonGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="button-group"
			className={cn(
				"inline-flex w-fit items-center rounded-[var(--control-pill-radius,999px)]",
				nativeRaisedSurface,
				"*:data-[slot=button]:bg-transparent *:data-[slot=button]:text-text-secondary *:data-[slot=button]:shadow-none *:data-[slot=button]:hover:bg-[var(--fill-quiet,color-mix(in_srgb,var(--text-primary)_5.5%,transparent))] *:data-[slot=button]:hover:text-text-primary *:data-[slot=button]:focus-visible:shadow-[0_0_0_2px_color-mix(in_srgb,var(--border-focus)_55%,transparent)] [&>[data-slot=button]+[data-slot=button]]:-ml-0.5",
				className,
			)}
			{...props}
		/>
	)
}

export { ButtonGroup }
