import { OTPInputContext } from "input-otp"
import * as React from "react"

import { cn } from "./lib/utils"

function InputOTPSlot({
	index,
	className,
	...props
}: React.ComponentProps<"div"> & {
	index: number
}) {
	const inputOTPContext = React.use(OTPInputContext)
	const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {}

	return (
		<div
			data-slot="input-otp-slot"
			data-active={isActive}
			className={cn(
				"relative flex h-8 w-8 items-center justify-center border-y border-r border-input bg-background/80 text-[13px] transition-[background-color,border-color,box-shadow] outline-none first:rounded-l-[6px] first:border-l last:rounded-r-[6px] aria-invalid:border-destructive data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-2 data-[active=true]:ring-ring/40 data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive/20 dark:bg-input/30 dark:data-[active=true]:aria-invalid:ring-destructive/40",
				className,
			)}
			{...props}
		>
			{char}
			{hasFakeCaret && (
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
					<div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
				</div>
			)}
		</div>
	)
}

export { InputOTPSlot }
