import type * as React from "react"
import { cn } from "./lib/utils"

function NativeSelectOptGroup({ className, ...props }: React.ComponentProps<"optgroup">) {
	return <optgroup data-slot="native-select-optgroup" className={cn(className)} {...props} />
}

export { NativeSelectOptGroup }
