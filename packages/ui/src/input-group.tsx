import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"
import { Button } from "./button"
import { Input } from "./input"
import { nativeTextFieldSurface } from "./lib/native-styles"
import { cn } from "./lib/utils"
import { Textarea } from "./textarea"

const inputGroupVariants = cva(
	[
		"group/input-group relative flex w-full min-w-0 items-center outline-none transition-[background-color,border-color,color,box-shadow]",
		nativeTextFieldSurface,
	],
	{
		variants: {
			variant: {
				default: "rounded-[var(--control-radius,6px)]",
				search: "gap-2 rounded-full",
			},
			size: {
				sm: "",
				default: "",
			},
		},
		compoundVariants: [
			{ variant: "default", size: "sm", className: "h-[var(--control-height-sm,28px)]" },
			{ variant: "default", size: "default", className: "h-[var(--input-height-md,36px)]" },
			{ variant: "search", size: "sm", className: "h-9 px-3" },
			{ variant: "search", size: "default", className: "h-10 px-3.5" },
		],
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
)

const inputGroupAddonVariants = cva(
	"flex h-auto cursor-text items-center justify-center gap-1.5 py-1 text-[14px] font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 group-data-[variant=search]/input-group:px-0 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4 group-data-[variant=search]/input-group:[&>svg:not([class*='size-'])]:size-[17px]",
	{
		variants: {
			align: {
				"inline-start":
					"order-first pl-3 group-data-[variant=search]/input-group:pl-0 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]",
				"inline-end":
					"order-last pr-3 group-data-[variant=search]/input-group:pr-0 has-[>button]:mr-[-0.45rem] has-[>kbd]:mr-[-0.35rem]",
				"block-start":
					"order-first w-full justify-start px-3 pt-3 group-has-[>input]/input-group:pt-2.5 [.border-b]:pb-3",
				"block-end":
					"order-last w-full justify-start px-3 pb-3 group-has-[>input]/input-group:pb-2.5 [.border-t]:pt-3",
			},
		},
		defaultVariants: {
			align: "inline-start",
		},
	},
)

const inputGroupButtonVariants = cva("shadow-none", {
	variants: {
		size: {
			xs: "",
			sm: "",
			"icon-xs": "",
			"icon-sm": "",
		},
	},
	defaultVariants: {
		size: "xs",
	},
})

function InputGroup({
	className,
	variant = "default",
	size = "default",
	role,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupVariants>) {
	const groupRole = role ?? (ariaLabel || ariaLabelledBy ? "group" : undefined)
	const accessibilityProps = groupRole
		? { role: groupRole, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy }
		: {}

	return (
		<div
			data-slot="input-group"
			data-variant={variant}
			data-size={size}
			{...accessibilityProps}
			className={cn(
				inputGroupVariants({ variant, size }),
				"has-[>textarea]:h-auto",
				"has-[>[data-align=inline-start]]:[&>input]:pl-2",
				"has-[>[data-align=inline-end]]:[&>input]:pr-2",
				"has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3",
				"has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3",
				"has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/40",
				"has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-destructive/20 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40",
				className,
			)}
			{...props}
		/>
	)
}

function InputGroupAddon({
	className,
	align = "inline-start",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
	return (
		<div
			data-slot="input-group-addon"
			data-align={align}
			className={cn(inputGroupAddonVariants({ align }), className)}
			onPointerDown={(e) => {
				if ((e.target as HTMLElement).closest("button")) {
					return
				}
				e.currentTarget.parentElement?.querySelector("input")?.focus()
			}}
			{...props}
		/>
	)
}

function InputGroupButton({
	className,
	type = "button",
	variant = "ghost",
	size = "xs",
	...props
}: Omit<React.ComponentProps<typeof Button>, "size"> &
	VariantProps<typeof inputGroupButtonVariants>) {
	return (
		<Button
			type={type}
			variant={variant}
			size={size}
			className={cn(inputGroupButtonVariants({ size }), className)}
			{...props}
		/>
	)
}

function InputGroupInput({ className, ...props }: React.ComponentProps<typeof Input>) {
	return (
		<Input
			data-slot="input-group-control"
			className={cn(
				"h-full flex-1 rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0",
				className,
			)}
			{...props}
		/>
	)
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			className={cn(
				"flex items-center gap-2 text-sm text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		/>
	)
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<Textarea
			data-slot="input-group-control"
			className={cn(
				"flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0 dark:bg-transparent",
				className,
			)}
			{...props}
		/>
	)
}

export {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
	InputGroupText,
	InputGroupTextarea,
}
