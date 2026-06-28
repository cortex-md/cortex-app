import { Button } from "@cortex/ui/button"
import { ArrowRight } from "lucide-react"
import { downloadPlatforms } from "../../../content/landing"
import { trackLandingEvent } from "../../../lib/analytics"
import { ProductMedia } from "../components/ProductMedia"

function hasDownloadHref() {
	return downloadPlatforms.some((platform) =>
		platform.options.some((option) => "href" in option && Boolean(option.href)),
	)
}

export function HeroSection() {
	const hasDownload = hasDownloadHref()

	return (
		<section
			className="mx-auto w-[min(1180px,calc(100%_-_64px))] pt-[140px] max-lg:w-[min(calc(100%_-_48px),940px)] max-md:w-[min(calc(100%_-_36px),720px)] max-md:pt-[124px] max-sm:w-[min(calc(100%_-_28px),520px)] max-sm:pt-[108px]"
			aria-labelledby="hero-title"
		>
			<div className="grid grid-cols-[minmax(0,0.92fr)_minmax(280px,0.42fr)] items-end gap-10 max-lg:grid-cols-1">
				<div>
					<h1
						className="m-0 max-w-[880px] text-balance text-[clamp(46px,6vw,76px)] leading-[1] font-semibold tracking-[-0.025em] max-sm:text-[clamp(34px,9.4vw,38px)] max-sm:leading-[1.04] max-sm:tracking-[-0.012em]"
						id="hero-title"
					>
						A Markdown workspace for notes you actually own.
					</h1>
					<p className="mt-7 max-w-[710px] text-[clamp(18px,2vw,22px)] leading-[1.5] font-normal text-text-secondary max-sm:text-base">
						Cortex is local-first, open source, and built on plain Markdown files, with optional
						sync that keeps readable notes on your devices.
					</p>
					<div className="mt-8 flex flex-wrap items-center gap-3 max-sm:grid">
						<Button
							className="max-sm:w-full tracking-normal"
							size="lg"
							onClick={() =>
								trackLandingEvent({
									name: "hero_primary_cta_clicked",
									location: "hero",
								})
							}
							asChild
						>
							<a href="#downloads">
								{hasDownload ? "Download Free" : "See availability"}
								<ArrowRight aria-hidden="true" />
							</a>
						</Button>
					</div>
				</div>
			</div>
			<div className="mt-12 max-md:mt-10">
				<ProductMedia
					label="Cortex workspace"
					description="Cortex desktop workspace with a custom dark theme applied."
					alt="Cortex desktop workspace showing a custom dark theme over Markdown notes."
					src="/media/cortex-community-theme.png"
					webpSrc="/media/cortex-community-theme.webp"
					width={1548}
					height={983}
					priority
				/>
			</div>
		</section>
	)
}
