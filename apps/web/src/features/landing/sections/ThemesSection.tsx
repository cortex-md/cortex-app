import { FolderOpen, Moon, Paintbrush } from "lucide-react"
import { communityThemeShowcase, developerStories } from "../../../content/landing"
import { ProductMedia } from "../components/ProductMedia"

const themePointIcons = [FolderOpen, Moon, Paintbrush] as const
const themePointToneClasses = [
	"bg-accent-amber-subtle text-accent-amber-text",
	"bg-accent-sky-subtle text-accent-sky-text",
	"bg-accent-sage-subtle text-accent-sage-text",
] as const

export function ThemesSection() {
	const story = developerStories.themes
	const { image, points } = communityThemeShowcase

	return (
		<section className="scroll-mt-24 py-24 max-md:py-[80px] max-sm:py-[68px]" id="themes">
			<div className="mx-auto w-[min(1180px,calc(100%_-_64px))] max-lg:w-[min(calc(100%_-_48px),940px)] max-md:w-[min(calc(100%_-_36px),720px)] max-sm:w-[min(calc(100%_-_28px),520px)]">
				<div className="grid grid-cols-[minmax(0,0.98fr)_minmax(300px,0.62fr)] items-center gap-12 max-lg:grid-cols-1 max-lg:gap-10">
					<ProductMedia
						className="w-full max-w-[760px] justify-self-center max-lg:max-w-[860px]"
						label={image.label}
						description={image.description}
						alt={image.alt}
						src={image.src}
						webpSrc="/media/theme.webp"
						width={image.width}
						height={image.height}
						aspect="hero"
						fit="cover"
						tone="ink"
					/>

					<div className="min-w-0">
						<h2 className="m-0 max-w-[620px] text-balance text-[clamp(30px,3.2vw,44px)] leading-[1.1] font-semibold tracking-[-0.015em] max-sm:text-[25px]">
							{story.title}
						</h2>
						<p className="mt-5 mb-0 max-w-[620px] text-[15px] leading-[1.7] text-muted-foreground">
							{story.description}
						</p>

						<ul className="mt-8 mb-0 grid p-0">
							{points.map((point, index) => {
								const Icon = themePointIcons[index] ?? Paintbrush

								return (
									<li
										className="grid grid-cols-[34px_minmax(0,1fr)] gap-4 border-border/70 border-b py-5 first:pt-0 last:border-b-0 last:pb-0 max-lg:first:pt-5"
										key={point.title}
									>
										<span
											className={`grid size-[34px] place-items-center rounded-lg ${themePointToneClasses[index % themePointToneClasses.length]}`}
										>
											<Icon className="size-4" aria-hidden="true" />
										</span>
										<div>
											<h3 className="m-0 text-[17px] leading-tight font-semibold">{point.title}</h3>
											<p className="mt-2 mb-0 text-sm leading-[1.65] text-muted-foreground">
												{point.description}
											</p>
										</div>
									</li>
								)
							})}
						</ul>
					</div>
				</div>
			</div>
		</section>
	)
}
