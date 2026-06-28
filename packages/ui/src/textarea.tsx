import type * as React from "react"

import { nativeControlSurface, nativeFocusRing } from "./lib/native-styles"
import { cn } from "./lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"flex field-sizing-content min-h-16 w-full rounded-[6px] px-2 py-1.5 text-[13px] leading-5 outline-none transition-[background-color,border-color,color,box-shadow] placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
				nativeControlSurface,
				nativeFocusRing,
				className,
			)}
			{...props}
		/>
	)
}

export { Textarea }
