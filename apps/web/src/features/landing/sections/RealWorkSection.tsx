import { cn } from "@cortex/ui/lib/utils"
import { Link2, Search } from "lucide-react"
import type React from "react"
import { realWorkGroup } from "../../../content/landing"
import { revealClass } from "../../site/motion"
import { Painting, type PaintingName } from "../../site/Painting"
import { glassPaneClass } from "../components/FeatureStory"
import { GroupHeading, HomeSection } from "../components/HomeLayout"
import { LinkNoteMock } from "../components/mocks/LinkNoteMock"
import { SearchMock } from "../components/mocks/SearchMock"

function Tile({
	icon: Icon,
	title,
	description,
	painting,
	position,
	label,
	children,
}: {
	icon: typeof Link2
	title: string
	description: string
	painting: PaintingName
	position: string
	label: string
	children: React.ReactNode
}) {
	return (
		<article
			className={cn(
				"relative flex flex-col gap-[18px] overflow-hidden rounded-[22px] bg-bg-elevated p-[26px] shadow-ring transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:-translate-y-[3px] hover:shadow-lift motion-reduce:transition-none motion-reduce:hover:translate-y-0 max-sm:p-5",
				revealClass,
			)}
		>
			<h3 className="flex items-center gap-2 text-[21px] leading-[1.2] font-semibold tracking-[-0.02em]">
				<Icon className="size-4 shrink-0" aria-hidden="true" />
				{title}
			</h3>
			<p className="text-[15px] leading-[1.5] text-text-secondary">{description}</p>
			<div className="max-sm:overflow-hidden">
				<figure
					className="relative isolate m-0 min-h-[330px] flex-1 overflow-hidden rounded-[18px] max-sm:w-[500px] max-sm:[zoom:0.59]"
					aria-label={label}
				>
					<Painting name={painting} position={position} />
					<div className={cn(glassPaneClass, "inset-[26px]")}>{children}</div>
				</figure>
			</div>
		</article>
	)
}

export function RealWorkSection() {
	return (
		<HomeSection aria-labelledby="real-work-title">
			<GroupHeading
				headingId="real-work-title"
				title={realWorkGroup.title}
				quiet={realWorkGroup.quiet}
				description={realWorkGroup.description}
			/>
			<div className="mt-14 grid grid-cols-2 gap-3.5 max-[1000px]:grid-cols-1">
				<Tile
					icon={Link2}
					title={realWorkGroup.links.title}
					description={realWorkGroup.links.description}
					painting="dawn"
					position="center 40%"
					label="Typing a link to the Roadmap note and the new backlink appearing"
				>
					<LinkNoteMock variant="tile" />
				</Tile>
				<Tile
					icon={Search}
					title={realWorkGroup.search.title}
					description={realWorkGroup.search.description}
					painting="mist"
					position="center 70%"
					label="Searching for launch and three matching notes appearing"
				>
					<SearchMock />
				</Tile>
			</div>
		</HomeSection>
	)
}
