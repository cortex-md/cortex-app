import { ChevronDownIcon } from "lucide-react"
import { Accordion as AccordionPrimitive } from "radix-ui"
import type * as React from "react"

function cx(...classes: Array<string | undefined>) {
	return classes.filter(Boolean).join(" ")
}

function Accordion({ ...props }: React.ComponentProps<typeof AccordionPrimitive.Root>) {
	return <AccordionPrimitive.Root data-slot="landing-accordion" {...props} />
}

function AccordionItem({
	className,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
	return (
		<AccordionPrimitive.Item
			data-slot="landing-accordion-item"
			className={cx("border-b last:border-b-0", className)}
			{...props}
		/>
	)
}

function AccordionTrigger({
	className,
	children,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
	return (
		<AccordionPrimitive.Header className="flex">
			<AccordionPrimitive.Trigger
				data-slot="landing-accordion-trigger"
				className={cx(
					"flex min-h-10 flex-1 items-start justify-between gap-4 text-left text-sm font-medium outline-none transition-[background-color,border-color,color,box-shadow,text-decoration-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:no-underline focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
					className,
				)}
				{...props}
			>
				{children}
				<ChevronDownIcon
					className="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
					aria-hidden="true"
				/>
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	)
}

function AccordionContent({
	className,
	children,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
	return (
		<AccordionPrimitive.Content
			data-slot="landing-accordion-content"
			className="group grid overflow-hidden text-sm transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.2,0,0,1)] data-[state=closed]:grid-rows-[0fr] data-[state=closed]:opacity-0 data-[state=open]:grid-rows-[1fr] data-[state=open]:opacity-100"
			{...props}
		>
			<div
				className={cx(
					"min-h-0 transform-gpu pt-0 pb-4 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.2,0,0,1)] group-data-[state=closed]:-translate-y-2 group-data-[state=closed]:opacity-0 group-data-[state=open]:translate-y-0 group-data-[state=open]:opacity-100",
					className,
				)}
			>
				{children}
			</div>
		</AccordionPrimitive.Content>
	)
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger }
