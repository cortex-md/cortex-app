import { HoverCard as HoverCardPrimitive } from "radix-ui"
import type * as React from "react"
import { nativePopupContentMotion, nativePopupSurface } from "./lib/native-styles"
import { cn } from "./lib/utils"

function HoverCardContent({
	className,
	align = "center",
	sideOffset = 4,
	...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
	return (
		<HoverCardPrimitive.Portal data-slot="hover-card-portal">
			<HoverCardPrimitive.Content
				data-slot="hover-card-content"
				data-popup-surface=""
				align={align}
				sideOffset={sideOffset}
				className={cn(
					"z-50 w-64 origin-(--radix-hover-card-content-transform-origin) rounded-[var(--popup-radius,10px)] p-4 text-popover-foreground outline-hidden",
					nativePopupSurface,
					nativePopupContentMotion,
					className,
				)}
				{...props}
			/>
		</HoverCardPrimitive.Portal>
	)
}

export { HoverCardContent }
