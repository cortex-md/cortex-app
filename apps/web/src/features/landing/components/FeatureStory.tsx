import { cn } from "@cortex/ui/lib/utils"
import type React from "react"
import type { FeatureStoryCopy } from "../../../content/landing"
import { revealClass } from "../../site/motion"
import { Painting, type PaintingName } from "../../site/Painting"
import { CheckList } from "./HomeLayout"

export const glassPaneClass =
	"absolute z-[1] overflow-visible rounded-[18px] bg-[color-mix(in_srgb,var(--bg-primary)_86%,transparent)] shadow-[0_0_0_1px_rgba(255,255,255,0.4),0_24px_60px_-24px_rgba(30,20,30,0.45)] backdrop-blur-[16px] backdrop-saturate-[1.1]"

export function PaintedVisual({
	painting,
	position,
	label,
	children,
}: {
	painting: PaintingName
	position: string
	label: string
	children: React.ReactNode
}) {
	return (
		<div className="min-w-0 max-sm:overflow-hidden">
			<figure
				className="relative isolate m-0 h-[500px] overflow-hidden rounded-[28px] max-sm:w-[560px] max-sm:rounded-[34px] max-sm:[zoom:0.625]"
				aria-label={label}
			>
				<Painting name={painting} position={position} />
				<div className={cn(glassPaneClass, "inset-10")}>{children}</div>
			</figure>
		</div>
	)
}

export function FeatureStory({
	copy,
	reverse = false,
	visual,
}: {
	copy: FeatureStoryCopy
	reverse?: boolean
	visual: React.ReactNode
}) {
	return (
		<div
			className={cn(
				"mt-24 grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] items-center gap-[72px] max-[1000px]:grid-cols-1 max-[1000px]:gap-9 max-sm:mt-16",
				revealClass,
			)}
		>
			<div className={cn("max-[1000px]:max-w-[640px]", reverse && "min-[1001px]:order-2")}>
				<h3 className="text-[32px] leading-[1.15] font-semibold tracking-[-0.025em] max-sm:text-[26px]">
					{copy.title}
				</h3>
				<p className="mt-4 text-[17px] leading-[1.65] text-text-secondary max-sm:text-[16px]">
					{copy.description}
				</p>
				<CheckList className="mt-[22px]" items={copy.points} />
			</div>
			{visual}
		</div>
	)
}
