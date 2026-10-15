import { Button } from "@cortex/ui/button"
import { cn } from "@cortex/ui/lib/utils"
import { downloadPlatforms, downloadSection } from "../../../content/landing"
import { trackEvent } from "../../../lib/analytics"
import { CortexMark } from "../../site/CortexMark"
import { revealClass } from "../../site/motion"
import { homeWrapClass, QuietHeading } from "../components/HomeLayout"

function getPrimaryDownloadHref(platform: (typeof downloadSection.buttons)[number]["platform"]) {
	const entry = downloadPlatforms.find((item) => item.id === platform)
	const option = entry?.options.find((item) => "href" in item && item.href)
	return option && "href" in option ? option.href : undefined
}

export function DownloadSection() {
	return (
		<section
			id={downloadSection.id}
			aria-labelledby="download-title"
			className={cn(
				"mt-[140px] bg-[radial-gradient(60%_80%_at_50%_0%,var(--accent-subtle),transparent_70%)] py-[120px] text-center max-sm:mt-24 max-sm:py-20",
				revealClass,
			)}
		>
			<div className={homeWrapClass}>
				<CortexMark className="mx-auto size-16 rounded-2xl shadow-lift" size={64} />
				<QuietHeading
					id="download-title"
					className="mt-7"
					title={downloadSection.title}
					quiet={downloadSection.quiet}
				/>
				<div className="mt-9 flex flex-wrap justify-center gap-2.5 max-sm:flex-col max-sm:items-stretch max-sm:gap-2">
					{downloadSection.buttons.map((button) => {
						const href = getPrimaryDownloadHref(button.platform)
						if (!href) return null
						return (
							<Button
								key={button.platform}
								size="lg"
								variant={button.primary ? "default" : "secondary"}
								asChild
							>
								<a
									href={href}
									onClick={() =>
										trackEvent({
											name: "download_clicked",
											platform: button.platform,
											location: "home",
										})
									}
								>
									{button.label}
								</a>
							</Button>
						)
					})}
				</div>
			</div>
		</section>
	)
}
