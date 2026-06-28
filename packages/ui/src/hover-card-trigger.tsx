import { HoverCard as HoverCardPrimitive } from "radix-ui"
import type * as React from "react"

function HoverCardTrigger({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
	return <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
}

export { HoverCardTrigger }
