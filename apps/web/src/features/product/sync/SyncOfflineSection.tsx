import { cn } from "@cortex/ui/lib/utils"
import { Check, Laptop, Smartphone } from "lucide-react"
import type React from "react"
import { syncPage } from "../../../content/product"
import { Painting } from "../../site/Painting"
import { FeatureStory, MockFigure, ProductSection } from "../shared/layout"

const { offline } = syncPage
const cardClass =
	"rounded-2xl bg-[color-mix(in_srgb,var(--bg-primary)_90%,transparent)] px-4 py-3.5 text-left text-[14px] leading-[22px] shadow-lift backdrop-blur-[12px]"
const markClass =
	"rounded-[3px] bg-[color-mix(in_srgb,var(--status-success)_22%,transparent)] px-0.5 text-inherit"

function CardTitle({
	icon,
	label,
	state,
}: {
	icon: React.ReactNode
	label: string
	state: string
}) {
	return (
		<b className="mb-1.5 flex items-center gap-2 text-[13px] leading-none font-semibold">
			{icon}
			{label}
			<em className="ml-auto text-[11.5px] leading-none font-medium text-text-muted not-italic">
				{state}
			</em>
		</b>
	)
}

function Edit({ edit }: { edit: { before: string; mark: string; after: string } }) {
	return (
		<p className="m-0">
			{edit.before}
			<mark className={markClass}>{edit.mark}</mark>
			{edit.after}
		</p>
	)
}

function MergeVisual() {
	return (
		<MockFigure
			label={offline.alt}
			className="relative isolate flex h-[460px] flex-col justify-center gap-4 overflow-hidden rounded-[28px] p-9 max-sm:w-[466px] max-sm:[zoom:0.75]"
		>
			<Painting name="mist" position="center 60%" />
			<div className="relative z-[1] grid grid-cols-2 gap-3.5">
				{[
					{ icon: <Laptop className="size-4" />, data: offline.laptop },
					{ icon: <Smartphone className="size-4" />, data: offline.phone },
				].map(({ icon, data }) => (
					<div
						key={data.device}
						className={cn(cardClass, "animate-product-merge-source motion-reduce:animate-none")}
					>
						<CardTitle icon={icon} label={data.device} state={offline.offlineLabel} />
						<Edit edit={data} />
					</div>
				))}
			</div>
			<div className="relative z-[1] flex justify-center">
				<span className="rounded-full bg-[rgba(28,25,23,0.78)] px-3 py-1.5 text-[12px] leading-none font-medium text-white animate-product-merge-label motion-reduce:animate-none">
					{offline.merging}
				</span>
			</div>
			<div
				className={cn(
					cardClass,
					"relative z-[1] animate-product-merge-result motion-reduce:animate-none",
				)}
			>
				<CardTitle
					icon={<Check className="size-4 text-status-success-foreground" />}
					label={offline.mergedTitle}
					state={offline.mergedLabel}
				/>
				<Edit edit={offline.laptop} />
				<Edit edit={offline.phone} />
			</div>
		</MockFigure>
	)
}

export function SyncOfflineSection() {
	return (
		<ProductSection>
			<FeatureStory
				reverse
				title={offline.title}
				body={offline.body}
				points={offline.points}
				visual={<MergeVisual />}
			/>
		</ProductSection>
	)
}
