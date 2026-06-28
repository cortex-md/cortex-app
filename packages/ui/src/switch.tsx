import type { VariantProps } from "class-variance-authority"
import { Switch as SwitchPrimitive } from "radix-ui"
import type * as React from "react"

import { nativeFocusRing } from "./lib/native-styles"
import { cn } from "./lib/utils"
import { switchThumbVariants, switchVariants } from "./switch-variants"

function Switch({
	className,
	size = "default",
	...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & VariantProps<typeof switchVariants>) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			data-size={size}
			className={cn(switchVariants({ size }), nativeFocusRing, className)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className={cn(switchThumbVariants({ size }))}
			/>
		</SwitchPrimitive.Root>
	)
}

export { Switch }
