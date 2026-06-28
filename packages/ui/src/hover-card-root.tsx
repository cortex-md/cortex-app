import { HoverCard as HoverCardPrimitive } from "radix-ui"
import type * as React from "react"

function HoverCard({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
	return <HoverCardPrimitive.Root data-slot="hover-card" {...props} />
}

export { HoverCard }
