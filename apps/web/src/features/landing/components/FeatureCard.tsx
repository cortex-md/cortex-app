import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@cortex/ui/card"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

interface FeatureCardProps {
	title: string
	description: string
	icon?: LucideIcon
	tone?: "paper" | "ink"
	className?: string
	children?: ReactNode
}

export function FeatureCard({
	title,
	description,
	icon: Icon,
	tone = "paper",
	className = "",
	children,
}: FeatureCardProps) {
	const isInk = tone === "ink"
	const surfaceClassName = isInk
		? "border-white/[0.14] bg-white/[0.035] text-white"
		: "border-border/80 bg-card/80 text-card-foreground"
	const dividerClassName = isInk ? "border-white/[0.1]" : "border-border/70"
	const accentClassName = isInk ? "text-brand" : "text-brand-text"
	const descriptionClassName = isInk ? "text-white/[0.58]" : "text-muted-foreground"

	return (
		<Card
			className={`overflow-hidden rounded-lg shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_2px_8px_rgba(24,18,8,0.04)] ${surfaceClassName} ${className}`}
			data-feature-card
		>
			<CardHeader className={`gap-3 border-b px-5 py-4 ${dividerClassName}`}>
				{Icon ? <Icon className={`size-4 ${accentClassName}`} aria-hidden="true" /> : null}
				<CardTitle className="text-[16px] leading-[1.2] font-semibold">{title}</CardTitle>
			</CardHeader>
			<CardContent className="px-5 py-4">
				<CardDescription className={`text-sm leading-6 ${descriptionClassName}`}>
					{description}
				</CardDescription>
				{children}
			</CardContent>
		</Card>
	)
}
