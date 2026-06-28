"use client"

import { OTPInput } from "input-otp"
import type * as React from "react"

import { cn } from "./lib/utils"

function InputOTP({
	className,
	containerClassName,
	...props
}: React.ComponentProps<typeof OTPInput> & {
	containerClassName?: string
}) {
	return (
		<OTPInput
			data-slot="input-otp"
			containerClassName={cn("flex items-center gap-2 has-disabled:opacity-50", containerClassName)}
			className={cn("disabled:cursor-not-allowed", className)}
			{...props}
		/>
	)
}

export { InputOTP }
