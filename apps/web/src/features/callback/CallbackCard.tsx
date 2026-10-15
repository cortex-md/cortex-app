import { cn } from "@cortex/ui/lib/utils"
import type { ReactNode } from "react"

export type CallbackTone = "neutral" | "ok" | "warn"

const toneClasses: Record<CallbackTone, string> = {
	neutral: "bg-brand-subtle text-brand-text",
	ok: "bg-status-success-background text-status-success-foreground",
	warn: "bg-status-warning-background text-status-warning-foreground",
}

interface CallbackCardProps {
	icon: ReactNode
	tone?: CallbackTone
	title: ReactNode
	children?: ReactNode
	actions?: ReactNode
	fine?: ReactNode
}

export function CallbackCard({
	icon,
	tone = "neutral",
	title,
	children,
	actions,
	fine,
}: CallbackCardProps) {
	return (
		<div className="flex min-h-[600px] items-center justify-center bg-[radial-gradient(60%_50%_at_50%_0%,var(--accent-subtle),transparent_70%)] px-5 py-12 max-sm:min-h-[calc(100dvh-160px)] max-sm:items-start max-sm:pt-10">
			<section
				className="w-[min(440px,100%)] rounded-[22px] bg-bg-elevated p-8 text-center shadow-lift max-sm:p-6"
				aria-live="polite"
			>
				<span
					className={cn(
						"inline-flex size-[52px] items-center justify-center rounded-2xl [&_svg]:size-6",
						toneClasses[tone],
					)}
					aria-hidden="true"
				>
					{icon}
				</span>
				<h1 className="mt-[18px] text-[24px] leading-[1.25] font-semibold tracking-[-0.02em] text-balance">
					{title}
				</h1>
				{children}
				{actions ? <div className="mt-6 flex flex-col gap-2">{actions}</div> : null}
				{fine ? (
					<p className="mt-[18px] mb-0 text-[13px] leading-[1.55] text-text-muted [&_a]:text-text-secondary [&_a]:underline [&_a]:underline-offset-2 [&_button]:text-text-secondary [&_button]:underline [&_button]:underline-offset-2">
						{fine}
					</p>
				) : null}
			</section>
		</div>
	)
}

export function CallbackText({ children, role }: { children: ReactNode; role?: "alert" }) {
	return (
		<p className="mt-2 mb-0 text-[15px] leading-[1.55] text-pretty text-text-secondary" role={role}>
			{children}
		</p>
	)
}

export function CallbackSteps({ steps }: { steps: readonly string[] }) {
	return (
		<ol className="mt-5 mb-0 flex list-none flex-col gap-2.5 p-0 text-left">
			{steps.map((step, index) => (
				<li
					key={step}
					className="flex items-center gap-3 text-[14px] leading-[1.4] text-text-secondary"
				>
					<b className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-cell text-[12px] leading-none font-semibold text-text-primary">
						{index + 1}
					</b>
					{step}
				</li>
			))}
		</ol>
	)
}
