"use client"

import { Command as CommandPrimitive } from "cmdk"
import { SearchIcon } from "lucide-react"
import type * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog"
import { cn } from "./lib/utils"

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
	return (
		<CommandPrimitive
			data-slot="command"
			className={cn(
				"flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[inherit] bg-transparent text-popover-foreground",
				className,
			)}
			{...props}
		/>
	)
}

function CommandDialog({
	title = "Command Palette",
	description = "Search for a command to run...",
	children,
	className,
	commandProps,
	showCloseButton = true,
	...props
}: React.ComponentProps<typeof Dialog> & {
	title?: string
	description?: string
	className?: string
	commandProps?: React.ComponentProps<typeof Command>
	showCloseButton?: boolean
}) {
	const { className: commandClassName, ...restCommandProps } = commandProps ?? {}

	return (
		<Dialog {...props}>
			<DialogHeader className="sr-only">
				<DialogTitle>{title}</DialogTitle>
				<DialogDescription>{description}</DialogDescription>
			</DialogHeader>
			<DialogContent
				data-command-surface=""
				className={cn("overflow-hidden p-0 sm:max-w-[680px]", className)}
				showCloseButton={showCloseButton}
			>
				<Command
					className={cn(
						"**:data-[slot=command-input-wrapper]:h-14 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-14 [&_[cmdk-item]]:px-2.5 [&_[cmdk-item]]:py-2 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4",
						commandClassName,
					)}
					{...restCommandProps}
				>
					{children}
				</Command>
			</DialogContent>
		</Dialog>
	)
}

function CommandInput({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
	return (
		<div data-slot="command-input-wrapper" className="flex h-10 items-center gap-3 border-b px-4">
			<SearchIcon className="size-5 shrink-0 opacity-55" />
			<CommandPrimitive.Input
				data-slot="command-input"
				className={cn(
					"flex h-10 w-full rounded-md bg-transparent py-3 text-[15px] outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
					className,
				)}
				{...props}
			/>
		</div>
	)
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
	return (
		<CommandPrimitive.List
			data-slot="command-list"
			className={cn("max-h-[340px] scroll-py-1 overflow-x-hidden overflow-y-auto", className)}
			{...props}
		/>
	)
}

function CommandEmpty({ ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
	return (
		<CommandPrimitive.Empty
			data-slot="command-empty"
			className="py-8 text-center text-sm text-muted-foreground"
			{...props}
		/>
	)
}

function CommandGroup({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
	return (
		<CommandPrimitive.Group
			data-slot="command-group"
			className={cn(
				"overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
				className,
			)}
			{...props}
		/>
	)
}

function CommandSeparator({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
	return (
		<CommandPrimitive.Separator
			data-slot="command-separator"
			className={cn("-mx-1 h-px bg-border", className)}
			{...props}
		/>
	)
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
	return (
		<CommandPrimitive.Item
			data-slot="command-item"
			className={cn(
				"relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
				className,
			)}
			{...props}
		/>
	)
}

function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="command-shortcut"
			className={cn("ml-auto text-xs text-muted-foreground", className)}
			{...props}
		/>
	)
}

function CommandFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="command-footer"
			className={cn("flex min-h-10 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2", className)}
			{...props}
		/>
	)
}

function CommandFooterHint({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="command-footer-hint"
			className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}
			{...props}
		/>
	)
}

function CommandFooterKey({ className, ...props }: React.ComponentProps<"kbd">) {
	return (
		<kbd
			data-slot="command-footer-key"
			className={cn(
				"inline-flex min-w-5 items-center justify-center rounded-[5px] px-1.5 py-0.5 text-[11px] leading-none",
				className,
			)}
			{...props}
		/>
	)
}

export {
	Command,
	CommandDialog,
	CommandFooter,
	CommandFooterHint,
	CommandFooterKey,
	CommandInput,
	CommandList,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandShortcut,
	CommandSeparator,
}
