import type { ReactNode } from "react"

interface CardGridProps {
	children: ReactNode
	columns?: "1" | "2" | "3"
	className?: string
}

export function CardGrid({ children, columns = "3", className = "" }: CardGridProps) {
	const colsMap = {
		"1": "grid-cols-1",
		"2": "grid-cols-[repeat(auto-fit,minmax(300px,1fr))]",
		"3": "grid-cols-[repeat(auto-fit,minmax(320px,1fr))]",
	}

	return (
		<div className={`grid gap-4 ${colsMap[columns]} max-md:grid-cols-1 ${className}`}>
			{children}
		</div>
	)
}
