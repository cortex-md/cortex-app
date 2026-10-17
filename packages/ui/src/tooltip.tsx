import { Slot, Tooltip as TooltipPrimitive } from "radix-ui"
import type * as React from "react"

import { Kbd } from "./kbd"
import { cn } from "./lib/utils"

function TooltipProvider({
	delayDuration = 0,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
	return (
		<TooltipPrimitive.Provider
			data-slot="tooltip-provider"
			delayDuration={delayDuration}
			{...props}
		/>
	)
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
	return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
	return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
	className,
	sideOffset = 0,
	children,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				data-slot="tooltip-content"
				sideOffset={sideOffset}
				className={cn(
					"z-[110] w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
					className,
				)}
				{...props}
			>
				{children}
				<TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	)
}

interface SimpleTooltipProps
	extends Omit<React.ComponentProps<typeof TooltipPrimitive.Trigger>, "children"> {
	label: React.ReactNode
	shortcut?: string
	side?: React.ComponentProps<typeof TooltipPrimitive.Content>["side"]
	align?: React.ComponentProps<typeof TooltipPrimitive.Content>["align"]
	sideOffset?: number
	disabled?: boolean
	children: React.ReactElement
}

function SimpleTooltip({
	label,
	shortcut,
	side = "top",
	align,
	sideOffset = 6,
	disabled = false,
	children,
	...triggerProps
}: SimpleTooltipProps) {
	if (disabled || label === null || label === undefined || label === false || label === "") {
		return <Slot.Root {...triggerProps}>{children}</Slot.Root>
	}
	return (
		<Tooltip>
			<TooltipTrigger asChild {...triggerProps}>
				{children}
			</TooltipTrigger>
			<TooltipContent
				side={side}
				align={align}
				sideOffset={sideOffset}
				collisionPadding={8}
				className="flex min-h-6 max-w-[min(20rem,calc(100vw-1rem))] items-center justify-center gap-2 px-2.5 py-1 text-center leading-snug break-words"
			>
				{label}
				{shortcut && <Kbd>{shortcut}</Kbd>}
			</TooltipContent>
		</Tooltip>
	)
}

export { SimpleTooltip, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
