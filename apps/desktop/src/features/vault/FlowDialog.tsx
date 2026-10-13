import {
	Button,
	cn,
	DialogContent,
	DialogDescription,
	DialogTitle,
	Stepper,
	StepperItem,
	type StepperState,
} from "@cortex/ui"
import type { ComponentProps, ReactNode } from "react"

export function FlowDialogContent({
	className,
	children,
	...props
}: ComponentProps<typeof DialogContent>) {
	return (
		<DialogContent
			showCloseButton={false}
			className={cn("gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[540px]", className)}
			{...props}
		>
			{children}
		</DialogContent>
	)
}

export function FlowHeader({
	title,
	lead,
	children,
}: {
	title: ReactNode
	lead?: ReactNode
	children?: ReactNode
}) {
	return (
		<div className="px-6 pt-[22px] pb-1">
			<DialogTitle className="text-[17px] leading-[22px] font-semibold">{title}</DialogTitle>
			{lead ? (
				<DialogDescription className="mt-1 text-[13.5px] leading-5 text-text-secondary">
					{lead}
				</DialogDescription>
			) : null}
			{children}
		</div>
	)
}

export interface FlowStep {
	id: string
	label: string
}

export function FlowStepper({ steps, current }: { steps: readonly FlowStep[]; current: string }) {
	const currentIndex = steps.findIndex((step) => step.id === current)
	return (
		<Stepper aria-label="Steps" className="mt-3.5">
			{steps.map((step, index) => {
				const state: StepperState =
					index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming"
				return (
					<StepperItem key={step.id} index={index + 1} state={state}>
						{step.label}
					</StepperItem>
				)
			})}
		</Stepper>
	)
}

export function FlowProgressBars({ total, current }: { total: number; current: number }) {
	return (
		<div aria-hidden="true" className="mt-3.5 flex gap-1.5">
			{Array.from({ length: total }, (_, index) => (
				<i
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative bars
					key={index}
					className={cn("h-[3px] flex-1 rounded-full bg-bg-hover", index <= current && "bg-brand")}
				/>
			))}
		</div>
	)
}

export function FlowBody({ className, ...props }: ComponentProps<"div">) {
	return <div className={cn("px-6 pt-4 pb-1", className)} {...props} />
}

export function FlowFooter({ start, children }: { start?: ReactNode; children?: ReactNode }) {
	return (
		<div className="flex items-center gap-2 px-6 pt-[18px] pb-[22px]">
			{start}
			<span className="flex-1" />
			{children}
		</div>
	)
}

export function FlowLabel({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			className={cn("mb-2 text-[12px] leading-none font-medium text-text-secondary", className)}
			{...props}
		/>
	)
}

export function FlowNote({
	icon,
	className,
	children,
}: {
	icon?: ReactNode
	className?: string
	children: ReactNode
}) {
	return (
		<div
			className={cn(
				"mt-1 flex gap-2 text-[12.5px] leading-[18px] text-text-secondary [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0",
				className,
			)}
		>
			{icon}
			<span>{children}</span>
		</div>
	)
}

export function FlowError({ children }: { children: ReactNode }) {
	if (!children) return null
	return (
		<p
			role="alert"
			className="mt-2.5 mb-0 text-[12.5px] leading-[18px] text-status-error-foreground"
		>
			{children}
		</p>
	)
}

export function FlowLocation({
	path,
	onChange,
	disabled,
}: {
	path: string
	onChange?: () => void
	disabled?: boolean
}) {
	return (
		<div className="flex items-center justify-between gap-2.5 rounded-[10px] bg-bg-hover py-1.5 pr-1.5 pl-3 font-mono text-[12.5px] leading-none">
			<span className="truncate" title={path}>
				{path}
			</span>
			{onChange ? (
				<Button variant="ghost" size="xs" onClick={onChange} disabled={disabled}>
					Change…
				</Button>
			) : null}
		</div>
	)
}

export function FlowSummary({ rows }: { rows: readonly { label: string; value: ReactNode }[] }) {
	return (
		<dl className="mt-1 mb-0 grid gap-0.5">
			{rows.map((row) => (
				<div
					key={row.label}
					className="flex justify-between gap-3 border-b border-settings-group-divider py-[9px] text-[13px] leading-[18px]"
				>
					<dt className="text-text-secondary">{row.label}</dt>
					<dd className="m-0 text-right">{row.value}</dd>
				</div>
			))}
		</dl>
	)
}
