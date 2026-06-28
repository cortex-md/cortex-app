import type * as React from "react"

import { cn } from "./lib/utils"

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div data-slot="input-otp-group" className={cn("flex items-center", className)} {...props} />
	)
}

export { InputOTPGroup }
