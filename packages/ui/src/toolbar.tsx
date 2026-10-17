import type * as React from "react"
import { cn } from "./lib/utils"

function Toolbar({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			role="toolbar"
			data-slot="toolbar"
			className={cn(
				"inline-flex w-fit items-center gap-0.5 rounded-[var(--control-pill-radius,999px)] border-0 bg-[var(--surface-raised,var(--bg-elevated))] p-1 shadow-[var(--shadow-floating-pill,var(--shadow-raised))]",
				className,
			)}
			{...props}
		/>
	)
}

function ToolbarSeparator({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			role="separator"
			aria-orientation="vertical"
			data-slot="toolbar-separator"
			className={cn(
				"mx-1 h-[18px] w-px shrink-0 bg-[var(--hairline,color-mix(in_srgb,var(--text-primary)_10%,transparent))]",
				className,
			)}
			{...props}
		/>
	)
}

export { Toolbar, ToolbarSeparator }
