"use client"

import { Progress as ProgressPrimitive } from "radix-ui"
import type * as React from "react"

import { nativeAccentFill } from "./lib/native-styles"
import { cn } from "./lib/utils"

function Progress({
	className,
	value,
	...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
	return (
		<ProgressPrimitive.Root
			data-slot="progress"
			className={cn("relative h-2 w-full overflow-hidden rounded-full bg-brand/20", className)}
			{...props}
		>
			<ProgressPrimitive.Indicator
				data-slot="progress-indicator"
				className={cn("h-full w-full flex-1 transition-transform", nativeAccentFill)}
				style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
			/>
		</ProgressPrimitive.Root>
	)
}

export { Progress }
