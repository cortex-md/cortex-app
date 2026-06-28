import { frequentlyAskedQuestions } from "../../../content/landing"
import { trackLandingEvent } from "../../../lib/analytics"
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "../components/LandingAccordion"

export function FaqSection() {
	return (
		<section className="scroll-mt-24 py-24 max-md:py-[80px] max-sm:py-[68px]" id="faq">
			<div className="mx-auto grid w-[min(1180px,calc(100%_-_64px))] grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)] gap-[96px] max-lg:w-[min(calc(100%_-_48px),940px)] max-lg:gap-16 max-md:w-[min(calc(100%_-_36px),720px)] max-md:grid-cols-1 max-sm:w-[min(calc(100%_-_28px),520px)]">
				<div className="sticky top-[120px] self-start max-md:static">
					<h2 className="m-0 text-balance text-[clamp(34px,3.6vw,46px)] leading-[1.1] font-medium">
						Before you make room for another tool.
					</h2>
					<p className="mt-6 max-w-[360px] text-[15px] leading-[1.65] text-muted-foreground">
						Short answers for the product decisions people usually want to understand first.
					</p>
				</div>
				<Accordion
					className="border-border-strong border-t"
					type="single"
					collapsible
					onValueChange={(value) => {
						const question = frequentlyAskedQuestions[Number(value)]?.question
						if (question) {
							trackLandingEvent({ name: "faq_opened", question })
						}
					}}
				>
					{frequentlyAskedQuestions.map((item, index) => (
						<AccordionItem
							className="border-border-strong"
							key={item.question}
							value={String(index)}
						>
							<AccordionTrigger className="px-1 py-7 text-left text-base font-semibold hover:bg-transparent hover:no-underline">
								{item.question}
							</AccordionTrigger>
							<AccordionContent className="px-1 pt-0 pr-12 pb-7 text-sm leading-[1.7] text-muted-foreground">
								{item.answer}
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			</div>
		</section>
	)
}
