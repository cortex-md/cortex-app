import type { VariantProps } from "class-variance-authority"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"
import type * as React from "react"

import { nativeFocusRing } from "./lib/native-styles"
import { cn } from "./lib/utils"
import {
	radioCardMediaVariants,
	radioCardVariants,
	radioGroupItemVariants,
} from "./radio-group-variants"

function RadioGroup({
	className,
	...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
	return (
		<RadioGroupPrimitive.Root
			data-slot="radio-group"
			className={cn("grid gap-1", className)}
			{...props}
		/>
	)
}

function RadioGroupItem({
	className,
	...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
	return (
		<RadioGroupPrimitive.Item
			data-slot="radio-group-item"
			className={cn(radioGroupItemVariants(), nativeFocusRing, className)}
			{...props}
		/>
	)
}

function RadioCard({
	className,
	size = "default",
	media,
	title,
	description,
	trailing,
	children,
	...props
}: Omit<React.ComponentProps<typeof RadioGroupPrimitive.Item>, "title"> &
	VariantProps<typeof radioCardVariants> & {
		media?: React.ReactNode
		title: React.ReactNode
		description?: React.ReactNode
		trailing?: React.ReactNode
	}) {
	return (
		<RadioGroupPrimitive.Item
			data-slot="radio-card"
			data-size={size}
			className={cn(radioCardVariants({ size }), className)}
			{...props}
		>
			{media ? (
				<span data-slot="radio-card-media" className={radioCardMediaVariants({ size })}>
					{media}
				</span>
			) : null}
			<span data-slot="radio-card-content" className="flex min-w-0 flex-1 flex-col">
				<span className="block text-[13.5px] leading-[18px] font-medium">{title}</span>
				{description ? (
					<span className="block text-[12.5px] leading-[17px] text-text-secondary">
						{description}
					</span>
				) : null}
				{children}
			</span>
			{trailing ? (
				<span
					data-slot="radio-card-trailing"
					className="shrink-0 whitespace-nowrap text-[11.5px] leading-none font-medium text-text-secondary"
				>
					{trailing}
				</span>
			) : null}
			<span
				aria-hidden="true"
				data-slot="radio-card-indicator"
				className="ml-auto size-4 shrink-0 rounded-full shadow-[inset_0_0_0_1.5px_var(--border-strong)] transition-[box-shadow] duration-150 ease-out group-data-[state=checked]/radio-card:shadow-[inset_0_0_0_5px_var(--accent)]"
			/>
		</RadioGroupPrimitive.Item>
	)
}

export { RadioCard, RadioGroup, RadioGroupItem }
