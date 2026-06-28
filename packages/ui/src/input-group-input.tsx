import type * as React from "react"
import { Input } from "./input"
import { cn } from "./lib/utils"

function InputGroupInput({ className, ...props }: React.ComponentProps<typeof Input>) {
	return (
		<Input
			data-slot="input-group-control"
			className={cn(
				"h-full flex-1 rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0",
				className,
			)}
			{...props}
		/>
	)
}

export { InputGroupInput }
