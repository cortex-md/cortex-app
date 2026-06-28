import { Bookmark, FolderOpen, Tags } from "lucide-react"
import type { organizationPanels } from "../../../content/landing"

type OrganizationPanel = (typeof organizationPanels)[number]

interface FeaturePanelProps {
	panel: OrganizationPanel
}

const toneClassNames = {
	blue: "bg-[#edf3fb]",
	sage: "bg-[#edf6ee]",
	amber: "bg-brand-subtle",
} as const

const panelIcons = {
	blue: FolderOpen,
	sage: Tags,
	amber: Bookmark,
} as const

export function FeaturePanel({ panel }: FeaturePanelProps) {
	const Icon = panelIcons[panel.tone]

	return (
		<article
			className={`relative flex flex-col overflow-hidden rounded-lg p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_2px_8px_rgba(24,18,8,0.05)] max-sm:p-5 ${toneClassNames[panel.tone]}`}
		>
			<div className="relative z-10 max-w-[310px]">
				<div className="mb-6 grid size-10 place-items-center rounded-md bg-white/55 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
					<Icon className="size-5" aria-hidden="true" />
				</div>
				<h3 className="m-0 text-pretty text-[clamp(24px,2.5vw,32px)] leading-[1.08] font-semibold max-sm:text-[24px]">
					{panel.title}
				</h3>
				<p className="mt-4 text-[15px] leading-[1.55] text-text-secondary">{panel.description}</p>
			</div>

			<div className="relative z-10 mt-auto grid gap-3 pt-10 max-sm:pt-8">
				{panel.items.map((item, index) => (
					<div
						className={`flex items-center gap-3 rounded-md bg-bg-elevated/92 px-4 py-3 text-sm font-semibold text-text-secondary ${
							index % 2 === 1 ? "ml-10 max-sm:ml-6" : "mr-10 max-sm:mr-6"
						}`}
						key={item}
					>
						<span className="size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
						<span className="min-w-0 truncate">{item}</span>
					</div>
				))}
			</div>
		</article>
	)
}
