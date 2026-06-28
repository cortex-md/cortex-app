import type { VariantProps } from "class-variance-authority"
import type * as React from "react"

import { inputVariants } from "./input-variants"
import { nativeFocusRing, nativeTextFieldSurface } from "./lib/native-styles"
import { cn } from "./lib/utils"

function Input({
	className,
	type,
	size = "default",
	...props
}: Omit<React.ComponentProps<"input">, "size"> & VariantProps<typeof inputVariants>) {
	return (
		<input
			type={type}
			data-slot="input"
			data-size={size}
			className={cn(inputVariants({ size }), nativeTextFieldSurface, nativeFocusRing, className)}
			{...props}
		/>
	)
}

export { Input }
