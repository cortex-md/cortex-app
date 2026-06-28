import { MinusIcon } from "lucide-react"
import type * as React from "react"

function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
	return (
		<div data-slot="input-otp-separator" aria-hidden="true" {...props}>
			<MinusIcon />
		</div>
	)
}

export { InputOTPSeparator }
