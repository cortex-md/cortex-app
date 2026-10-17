import type { VariantProps } from "class-variance-authority"
import { CheckIcon } from "lucide-react"
import type * as React from "react"

import { cn } from "./lib/utils"
import { stepperIndicatorVariants, stepperItemVariants } from "./stepper-variants"

type StepperState = NonNullable<VariantProps<typeof stepperItemVariants>["state"]>

function Stepper({ className, ...props }: React.ComponentProps<"ol">) {
	return (
		<ol
			data-slot="stepper"
			className={cn("m-0 flex list-none flex-wrap items-center gap-1.5 p-0", className)}
			{...props}
		/>
	)
}

function StepperItem({
	className,
	state = "upcoming",
	index,
	children,
	...props
}: React.ComponentProps<"li"> & { state?: StepperState; index: number }) {
	return (
		<li
			data-slot="stepper-item"
			data-state={state}
			aria-current={state === "current" ? "step" : undefined}
			className={cn(
				stepperItemVariants({ state }),
				"[&+&]:before:mr-0.5 [&+&]:before:h-px [&+&]:before:w-3.5 [&+&]:before:bg-border [&+&]:before:content-['']",
				className,
			)}
			{...props}
		>
			<span aria-hidden="true" className={stepperIndicatorVariants({ state })}>
				{state === "done" ? <CheckIcon strokeWidth={3} /> : index}
			</span>
			{children}
		</li>
	)
}

export { Stepper, StepperItem, type StepperState }
