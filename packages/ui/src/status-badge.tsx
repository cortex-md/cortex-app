import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

import { cn } from "./lib/utils"

const statusBadgeVariants = cva(
	"inline-flex w-fit max-w-full shrink-0 items-center overflow-hidden rounded-full leading-none font-medium whitespace-nowrap bg-[var(--status-badge-bg)] text-[var(--status-badge-fg)] [&>svg]:size-3",
	{
		variants: {
			color: {
				gray: "[--status-badge-bg:color-mix(in_srgb,var(--text-primary)_5%,transparent)] [--status-badge-fg:var(--text-secondary)]",
				blue: "[--status-badge-bg:color-mix(in_srgb,var(--syntax-function,#3f6fa8)_13%,var(--bg-primary))] [--status-badge-fg:color-mix(in_srgb,var(--syntax-function,#3f6fa8)_78%,var(--text-primary))]",
				green:
					"[--status-badge-bg:color-mix(in_srgb,var(--status-success)_13%,var(--bg-primary))] [--status-badge-fg:color-mix(in_srgb,var(--status-success)_78%,var(--text-primary))]",
				red: "[--status-badge-bg:color-mix(in_srgb,var(--status-error)_13%,var(--bg-primary))] [--status-badge-fg:color-mix(in_srgb,var(--status-error)_78%,var(--text-primary))]",
				amber:
					"[--status-badge-bg:color-mix(in_srgb,var(--status-warning)_13%,var(--bg-primary))] [--status-badge-fg:color-mix(in_srgb,var(--status-warning)_78%,var(--text-primary))]",
				purple:
					"[--status-badge-bg:color-mix(in_srgb,#7c3aed_13%,var(--bg-primary))] [--status-badge-fg:color-mix(in_srgb,#7c3aed_78%,var(--text-primary))]",
				pink: "[--status-badge-bg:color-mix(in_srgb,var(--accent)_13%,var(--bg-primary))] [--status-badge-fg:color-mix(in_srgb,var(--accent)_78%,var(--text-primary))]",
				teal: "[--status-badge-bg:color-mix(in_srgb,var(--syntax-type,#0d9488)_13%,var(--bg-primary))] [--status-badge-fg:color-mix(in_srgb,var(--syntax-type,#0d9488)_78%,var(--text-primary))]",
			},
			size: {
				default: "h-[22px] gap-1.5 px-2 text-xs",
				lg: "h-[26px] gap-[7px] px-[11px] text-[13px] [&>[data-slot=status-badge-dot]]:size-[7px]",
			},
		},
		defaultVariants: {
			color: "gray",
			size: "default",
		},
	},
)

type StatusBadgeColor = NonNullable<VariantProps<typeof statusBadgeVariants>["color"]>
type StatusBadgeSize = NonNullable<VariantProps<typeof statusBadgeVariants>["size"]>

function StatusBadge({
	className,
	color = "gray",
	size = "default",
	dot = true,
	children,
	...props
}: Omit<React.ComponentProps<"span">, "color"> & {
	color?: StatusBadgeColor
	size?: StatusBadgeSize
	dot?: boolean
}) {
	return (
		<span
			data-slot="status-badge"
			data-color={color}
			className={cn(statusBadgeVariants({ color, size }), className)}
			{...props}
		>
			{dot && (
				<span
					aria-hidden="true"
					data-slot="status-badge-dot"
					className="size-1.5 shrink-0 rounded-full bg-current"
				/>
			)}
			{children}
		</span>
	)
}

export { StatusBadge, type StatusBadgeColor, type StatusBadgeSize, statusBadgeVariants }
