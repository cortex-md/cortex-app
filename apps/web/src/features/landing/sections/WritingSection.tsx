import { workspaceDemoSteps } from "../../../content/landing"
import { ProductMedia } from "../components/ProductMedia"
import { SectionContainer } from "../components/SectionContainer"
import { SectionHeading } from "../components/SectionHeading"

export function WritingSection() {
	return (
		<section className="scroll-mt-24 py-44 max-md:py-[80px] max-sm:py-[68px]" id="product">
			<SectionContainer>
				<SectionHeading
					title="Write, find, and arrange without losing the thread."
					description="Cortex keeps the daily loop tight: edit in Markdown, jump between notes, split context, and stay close to the keyboard."
				/>

				<div className="grid grid-cols-[minmax(300px,0.78fr)_minmax(0,1.22fr)] items-start gap-10 max-lg:grid-cols-1">
					<ol className="m-0 grid list-none gap-0 p-0">
						{workspaceDemoSteps.map((step, index) => (
							<li
								className="grid grid-cols-[44px_minmax(0,1fr)] gap-5 border-border/70 border-b py-5 last:border-b-0"
								key={step.title}
							>
								<span className="grid size-9 place-items-center rounded-md bg-bg-secondary text-sm font-semibold text-brand-text">
									{index + 1}
								</span>
								<div>
									<h3 className="m-0 text-[18px] leading-tight font-semibold">{step.title}</h3>
									<p className="mt-3 mb-0 text-sm leading-[1.65] text-muted-foreground">
										{step.description}
									</p>
								</div>
							</li>
						))}
					</ol>

					<ProductMedia
						label="Writing workflow"
						width={1648}
						height={900}
						fit="contain"
						description="Cortex editing workspace with Markdown notes, splits, and search context."
						alt="Cortex writing workspace showing Markdown notes, split panes, and search context."
						src="/media/write.png"
						webpSrc="/media/write.webp"
					/>
				</div>
			</SectionContainer>
		</section>
	)
}
