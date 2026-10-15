import { cn } from "@cortex/ui/lib/utils"
import { FileText, Github, ShieldCheck } from "lucide-react"
import { openSourceSplit } from "../../../content/landing"
import { revealClass } from "../../site/motion"
import { HomeSection } from "../components/HomeLayout"

const icons = { shield: ShieldCheck, file: FileText, github: Github } as const

export function OpenSourceSection() {
	return (
		<HomeSection aria-labelledby="open-source-title">
			<div
				className={cn(
					"grid grid-cols-[1fr_1.1fr] items-center gap-14 max-[1000px]:grid-cols-1 max-[1000px]:gap-9",
					revealClass,
				)}
			>
				<div>
					<h2
						id="open-source-title"
						className="text-[30px] leading-[1.15] font-semibold tracking-[-0.025em] max-sm:text-[26px]"
					>
						{openSourceSplit.title}
					</h2>
					<p className="mt-3.5 text-[16.5px] leading-[1.6] text-text-secondary max-sm:text-[16px]">
						{openSourceSplit.description}
					</p>
				</div>
				<ul className="grid gap-2 text-[15px] leading-[1.5] text-text-secondary">
					{openSourceSplit.points.map((point) => {
						const Icon = icons[point.icon]
						return (
							<li key={point.text} className="flex gap-2.5">
								<Icon className="mt-[3px] size-4 shrink-0 text-brand-text" aria-hidden="true" />
								<span>{point.text}</span>
							</li>
						)
					})}
				</ul>
			</div>
		</HomeSection>
	)
}
