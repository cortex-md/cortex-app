import type { ReactNode } from "react"

interface SectionContainerProps {
	children: ReactNode
	id?: string
	className?: string
}

export function SectionContainer({ children, id, className = "" }: SectionContainerProps) {
	return (
		<div
			className={`mx-auto w-[min(1180px,calc(100%_-_64px))] max-lg:w-[min(calc(100%_-_48px),940px)] max-md:w-[min(calc(100%_-_36px),720px)] max-sm:w-[min(calc(100%_-_28px),520px)] ${className}`}
			id={id}
		>
			{children}
		</div>
	)
}
