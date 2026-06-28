import { Button } from "@cortex/ui/button"
import { ArrowUpRight, Puzzle, ShieldCheck } from "lucide-react"
import { siteConfig } from "../../../config/site"
import { developerStories, pluginHighlights } from "../../../content/landing"
import { trackLandingEvent } from "../../../lib/analytics"
import { PluginCodeBlock } from "../components/PluginCodeBlock"

interface PluginSectionProps {
	pluginCodeHtml: string
}

type PluginHighlightTone = (typeof pluginHighlights)[number]["tone"]

const pluginToneClasses: Record<PluginHighlightTone, string> = {
	amber: "bg-accent-amber-subtle text-accent-amber-text",
	sage: "bg-accent-sage-subtle text-accent-sage-text",
}

const pluginHighlightIcons = [Puzzle, ShieldCheck] as const

export function PluginSection({ pluginCodeHtml }: PluginSectionProps) {
	const story = developerStories.plugins

	return (
		<section className="scroll-mt-24 py-24 max-md:py-[80px] max-sm:py-[68px]" id="developers">
			<span className="block scroll-mt-24" id="open-source" aria-hidden="true" />
			<div className="mx-auto grid w-[min(1180px,calc(100%_-_64px))] grid-cols-[minmax(0,0.44fr)_minmax(360px,0.56fr)] items-center gap-8 max-lg:w-[min(calc(100%_-_48px),940px)] max-lg:grid-cols-1 max-md:w-[min(calc(100%_-_36px),720px)] max-sm:w-[min(calc(100%_-_28px),520px)]">
				<div className="min-w-0 max-w-[580px]">
					<h2 className="m-0 text-balance text-[clamp(34px,4.4vw,56px)] leading-[1.05] font-semibold">
						{story.title}
					</h2>
					<p className="mt-6 mb-0 max-w-[620px] text-pretty text-[16px] leading-[1.68] text-muted-foreground">
						{story.description}
					</p>

					<div className="mt-8 grid gap-0">
						{pluginHighlights.map((item, index) => {
							const Icon = pluginHighlightIcons[index] ?? Puzzle

							return (
								<div
									className="grid grid-cols-[38px_minmax(0,1fr)] gap-4 border-border-subtle border-t py-5 last:border-b"
									key={item.title}
								>
									<span
										className={`grid size-[38px] place-items-center rounded-lg ${pluginToneClasses[item.tone]}`}
									>
										<Icon className="size-4" aria-hidden="true" />
									</span>
									<div>
										<h3 className="m-0 text-[15px] leading-tight font-semibold text-text-primary">
											{item.title}
										</h3>
										<p className="mt-2 mb-0 text-sm leading-[1.6] text-muted-foreground">
											{item.description}
										</p>
									</div>
								</div>
							)
						})}
					</div>

					<Button
						className="mt-7 border-border/80 bg-bg-elevated text-text-primary shadow-[0_1px_2px_rgba(17,19,26,0.04)] tracking-normal hover:bg-bg-secondary"
						variant="outline"
						asChild
						onClick={() =>
							trackLandingEvent({
								name: "github_clicked",
								location: "developers",
							})
						}
					>
						<a href={siteConfig.githubUrl} target="_blank" rel="noreferrer">
							View source
							<ArrowUpRight aria-hidden="true" />
						</a>
					</Button>
				</div>
				<div className="min-w-0">
					<PluginCodeBlock highlightedHtml={pluginCodeHtml} />
				</div>
			</div>
		</section>
	)
}
