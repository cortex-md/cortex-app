"use client"

import type { VariantProps } from "class-variance-authority"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"
import * as React from "react"
import { nativeGlassSurface } from "./lib/native-styles"
import { cn } from "./lib/utils"
import { toggleVariants } from "./toggle-variants"

const ToggleGroupContext = React.createContext<
	VariantProps<typeof toggleVariants> & {
		spacing?: number
	}
>({
	size: "default",
	variant: "default",
	spacing: 0,
})

function ToggleGroup({
	className,
	variant,
	size,
	spacing = 0,
	children,
	...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
	VariantProps<typeof toggleVariants> & {
		spacing?: number
	}) {
	const contextValue = React.useMemo(() => ({ variant, size, spacing }), [variant, size, spacing])

	return (
		<ToggleGroupPrimitive.Root
			data-slot="toggle-group"
			data-variant={variant}
			data-size={size}
			data-spacing={spacing}
			style={{ "--gap": spacing } as React.CSSProperties}
			className={cn(
				"group/toggle-group flex w-fit items-center gap-[--spacing(var(--gap))] rounded-full p-1 data-[variant=outline]:border data-[variant=outline]:border-border/50 data-[variant=outline]:bg-background/70 data-[variant=default]:bg-transparent",
				spacing === 0 && nativeGlassSurface,
				className,
			)}
			{...props}
		>
			<ToggleGroupContext.Provider value={contextValue}>{children}</ToggleGroupContext.Provider>
		</ToggleGroupPrimitive.Root>
	)
}

function ToggleGroupItem({
	className,
	children,
	variant,
	size,
	...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> & VariantProps<typeof toggleVariants>) {
	const context = React.use(ToggleGroupContext)

	return (
		<ToggleGroupPrimitive.Item
			data-slot="toggle-group-item"
			data-variant={context.variant || variant}
			data-size={context.size || size}
			data-spacing={context.spacing}
			className={cn(
				toggleVariants({
					variant: context.variant || variant,
					size: context.size || size,
				}),
				"w-auto min-w-7 shrink-0 rounded-full px-2 focus:z-10 focus-visible:z-10",
				"data-[spacing=0]:shadow-none data-[spacing=0]:data-[variant=outline]:border-l-0 data-[spacing=0]:data-[variant=outline]:first:border-l",
				className,
			)}
			{...props}
		>
			{children}
		</ToggleGroupPrimitive.Item>
	)
}

export { ToggleGroup, ToggleGroupItem }
