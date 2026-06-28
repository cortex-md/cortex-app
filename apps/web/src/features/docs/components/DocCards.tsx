import { ArrowUpRight } from "lucide-react"
import type { ReactNode } from "react"

interface DocGridProps {
	children: ReactNode
}

interface DocCardProps {
	href: string
	title: string
	description: string
}

export function DocGrid({ children }: DocGridProps) {
	return <div className="not-prose my-8 grid gap-3 sm:grid-cols-2">{children}</div>
}

export function DocCard({ href, title, description }: DocCardProps) {
	return (
		<a
			className="group rounded-lg bg-bg-elevated p-4 shadow-[0_0_0_1px_var(--border-subtle)] transition-[background-color,box-shadow] duration-150 ease-out hover:bg-bg-secondary hover:shadow-[0_0_0_1px_var(--border)] focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none"
			href={href}
		>
			<span className="flex items-start justify-between gap-4 text-[15px] leading-5 font-semibold text-text-primary">
				{title}
				<ArrowUpRight
					className="mt-0.5 size-4 shrink-0 text-text-muted transition-[opacity,transform] duration-150 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent"
					aria-hidden="true"
				/>
			</span>
			<span className="mt-2 block text-pretty text-[13px] leading-5 text-text-secondary">
				{description}
			</span>
		</a>
	)
}
