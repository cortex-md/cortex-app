import { ChevronDownIcon } from "lucide-react"
import type * as React from "react"
import { nativeControlFocusRing, nativeRaisedHover, nativeRaisedSurface } from "./lib/native-styles"
import { cn } from "./lib/utils"

function NativeSelect({
	className,
	size = "default",
	...props
}: Omit<React.ComponentProps<"select">, "size"> & { size?: "sm" | "default" }) {
	return (
		<div
			className="group/native-select relative w-fit has-[select:disabled]:opacity-50"
			data-slot="native-select-wrapper"
		>
			<select
				data-slot="native-select"
				data-size={size}
				className={cn(
					"h-[var(--button-height-md,36px)] w-full min-w-0 cursor-default appearance-none rounded-[var(--control-pill-radius,999px)] border-0 px-3.5 py-0 pr-9 text-[length:var(--control-font-size,14px)] leading-[var(--control-line-height,18px)] text-text-primary outline-none transition-[background-color,color,box-shadow] duration-[120ms] ease-out selection:bg-brand selection:text-text-on-accent placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed data-[size=sm]:h-[var(--button-height-xs,28px)] data-[size=sm]:px-3 data-[size=sm]:pr-8 data-[size=sm]:text-[13.5px]",
					nativeRaisedSurface,
					nativeRaisedHover,
					nativeControlFocusRing,
					"aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
					className,
				)}
				{...props}
			/>
			<ChevronDownIcon
				className="pointer-events-none absolute top-1/2 right-3.5 size-3.5 -translate-y-1/2 text-muted-foreground opacity-70 select-none"
				aria-hidden="true"
				data-slot="native-select-icon"
			/>
		</div>
	)
}

function NativeSelectOption({ ...props }: React.ComponentProps<"option">) {
	return <option data-slot="native-select-option" {...props} />
}

function NativeSelectOptGroup({ className, ...props }: React.ComponentProps<"optgroup">) {
	return <optgroup data-slot="native-select-optgroup" className={cn(className)} {...props} />
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption }
