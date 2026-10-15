import { cn } from "@cortex/ui/lib/utils"
import { marketplacePage } from "../../../content/product"
import { Painting } from "../../site/Painting"
import { FeatureStory, MockFigure, ProductSection } from "../shared/layout"
import { type MockPalette, mockPalettes } from "./mockPalettes"

const { themes } = marketplacePage

function ThemedNote({ palette }: { palette: MockPalette }) {
	const { note } = themes
	return (
		<div
			className={cn(
				"absolute inset-0 bg-[var(--m-bg)] px-10 py-[34px] text-left text-[15px] leading-6 text-[var(--m-fg)]",
				palette === "gruv" &&
					"[clip-path:inset(0_0_0_30%)] animate-product-sweep motion-reduce:animate-none",
			)}
			style={mockPalettes[palette]}
		>
			<h4 className="mb-1 text-[24px] leading-[1.2] font-bold">{note.title}</h4>
			<div className="mb-3.5 text-[12px] leading-none text-[var(--m-mute)]">{note.meta}</div>
			<p className="mb-3">
				{note.before}
				<span className="text-[var(--m-acc)] underline decoration-[color-mix(in_srgb,var(--m-acc)_40%,transparent)] underline-offset-[3px]">
					{note.link}
				</span>
				{note.after}
			</p>
			{note.tasks.map((task) => (
				<div
					key={task.label}
					className={cn(
						"flex items-center gap-2.5 py-[3px]",
						task.done && "text-[var(--m-mute)] line-through",
					)}
				>
					<i
						className={cn(
							"size-[15px] rounded-[4px]",
							task.done ? "bg-[var(--m-acc)]" : "shadow-[inset_0_0_0_1.5px_var(--m-line)]",
						)}
					/>
					{task.label}
				</div>
			))}
			<div className="mt-3.5 border-l-[3px] border-[var(--m-acc)] py-0.5 pl-3.5 text-[var(--m-2)] italic">
				{note.quote}
			</div>
		</div>
	)
}

export function MarketplaceThemesSection() {
	return (
		<ProductSection>
			<FeatureStory
				reverse
				title={themes.title}
				body={themes.body}
				points={themes.points}
				visual={
					<MockFigure
						label={themes.alt}
						className="relative isolate h-[500px] overflow-hidden rounded-[28px] max-sm:w-[620px] max-sm:rounded-[40px] max-sm:[zoom:0.565]"
					>
						<Painting name="dusk" position="center 58%" />
						<div className="absolute inset-11 z-[1] overflow-hidden rounded-[18px] shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_30px_60px_-24px_rgba(30,20,30,0.5)]">
							<ThemedNote palette="paper" />
							<ThemedNote palette="gruv" />
							<i className="absolute inset-y-0 left-[30%] z-[2] -ml-px w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)] animate-product-handle after:absolute after:top-1/2 after:left-1/2 after:-mt-[15px] after:-ml-[15px] after:size-[30px] after:rounded-full after:bg-white after:shadow-[0_4px_14px_rgba(0,0,0,0.25)] motion-reduce:animate-none" />
							<em className="absolute bottom-3.5 left-3.5 z-[2] rounded-full bg-[rgba(28,25,23,0.72)] px-2.5 py-[5px] text-[12px] leading-none font-medium text-white not-italic">
								{themes.labels.paper}
							</em>
							<em className="absolute right-3.5 bottom-3.5 z-[2] rounded-full bg-[rgba(250,189,47,0.92)] px-2.5 py-[5px] text-[12px] leading-none font-medium text-[#1d2021] not-italic">
								{themes.labels.gruvbox}
							</em>
						</div>
					</MockFigure>
				}
			/>
		</ProductSection>
	)
}
