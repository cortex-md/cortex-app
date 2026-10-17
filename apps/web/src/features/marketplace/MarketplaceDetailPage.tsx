import { Button } from "@cortex/ui/button"
import { cn } from "@cortex/ui/lib/utils"
import {
	ArrowUpRight,
	BadgeCheck,
	BookOpen,
	ChevronLeft,
	ChevronRight,
	Flag,
	Github,
	Shield,
} from "lucide-react"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import {
	getCapabilityLabel,
	marketplaceCopy,
	marketplaceKindLabels,
	reportProblemUrl,
} from "../../content/marketplace"
import { trackEvent } from "../../lib/analytics"
import type { DiscussionCommentsResult } from "../../server/discussions"
import type { MarketplaceItem } from "../../server/marketplace"
import type { MarketplaceReadme } from "../../server/readme"
import { RenderedMarkdown } from "../docs/components/RenderedMarkdown"
import { ItemGlyph, itemTone, ThemeWindow } from "./MarketplaceArt"
import { StaleNotice, SubmitBanner } from "./MarketplaceBits"
import { MarketplaceComments } from "./MarketplaceComments"
import { InstallPopover, VotePopover } from "./MarketplacePopovers"
import { formatCount, formatDate } from "./marketplaceModel"

function getInfoRows(item: MarketplaceItem): Array<[string, string]> {
	const rows: Array<[string, string | null]> = [
		["Votes", formatCount(item.votes)],
		["Downloads", formatCount(item.downloads)],
		["Version", item.version],
		["Updated", formatDate(item.releasedAt)],
		["Appearance", item.kind === "themes" ? item.appearance : null],
		["Requires", item.minAppVersion ? `Cortex ${item.minAppVersion} or later` : null],
	]
	return rows.filter((row): row is [string, string] => Boolean(row[1]))
}

function SideLink({
	href,
	icon,
	children,
	onClick,
}: {
	href: string
	icon: React.ReactNode
	children: React.ReactNode
	onClick?: () => void
}) {
	return (
		<a
			className="flex h-10 items-center gap-2.5 rounded-xl px-3 text-[14px] leading-none font-medium text-text-primary outline-none hover:bg-bg-hover focus-visible:shadow-focus max-sm:h-11 [&>svg:first-child]:size-[17px] [&>svg:first-child]:text-text-secondary"
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			onClick={onClick}
		>
			{icon}
			<span className="flex-1 truncate">{children}</span>
			<ArrowUpRight className="size-3.5 text-text-muted" aria-hidden="true" />
		</a>
	)
}

function ScreenshotFigure({ url, alt, single }: { url: string; alt: string; single: boolean }) {
	return (
		<figure
			className={cn(
				"m-0 min-w-0 overflow-hidden rounded-[22px] bg-cell",
				single
					? "w-full"
					: "h-[360px] flex-[0_0_auto] snap-start max-sm:h-60 max-sm:flex-[0_0_86%]",
			)}
		>
			<a
				className="block h-full rounded-[22px] outline-none focus-visible:shadow-focus"
				href={url}
				target="_blank"
				rel="noopener noreferrer"
				draggable={false}
			>
				<img
					draggable={false}
					className={cn(
						"object-cover",
						single ? "aspect-[16/9] w-full" : "aspect-[16/10] h-full w-auto max-sm:w-full",
					)}
					src={url}
					width={1280}
					height={single ? 720 : 800}
					alt={alt}
					loading="lazy"
					decoding="async"
					referrerPolicy="no-referrer"
				/>
			</a>
		</figure>
	)
}

interface StripEdges {
	atStart: boolean
	atEnd: boolean
}

interface StripDrag {
	pointerId: number
	startX: number
	startScroll: number
	moved: boolean
}

const dragThreshold = 6

function getStripEdges(strip: HTMLElement): StripEdges {
	return {
		atStart: strip.scrollLeft <= 1,
		atEnd: strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1,
	}
}

function getScrollBehavior(): ScrollBehavior {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
}

function snapToNearestSlide(strip: HTMLElement) {
	const slides = Array.from(strip.children) as HTMLElement[]
	const nearest = slides.reduce<HTMLElement | undefined>(
		(best, slide) =>
			!best ||
			Math.abs(slide.offsetLeft - strip.scrollLeft) < Math.abs(best.offsetLeft - strip.scrollLeft)
				? slide
				: best,
		undefined,
	)
	if (nearest) strip.scrollTo({ left: nearest.offsetLeft, behavior: getScrollBehavior() })
}

function ScreenshotStrip({
	className,
	children,
}: {
	className?: string
	children: React.ReactNode
}) {
	const stripRef = useRef<HTMLDivElement | null>(null)
	const dragRef = useRef<StripDrag | null>(null)
	const suppressClickRef = useRef(false)
	const [edges, setEdges] = useState<StripEdges>({ atStart: true, atEnd: true })

	useEffect(() => {
		const strip = stripRef.current
		if (!strip) return
		const updateEdges = () => {
			const next = getStripEdges(strip)
			setEdges((current) =>
				current.atStart === next.atStart && current.atEnd === next.atEnd ? current : next,
			)
		}
		updateEdges()
		strip.addEventListener("scroll", updateEdges, { passive: true })
		const observer = new ResizeObserver(updateEdges)
		observer.observe(strip)
		return () => {
			strip.removeEventListener("scroll", updateEdges)
			observer.disconnect()
		}
	}, [])

	function scrollByPage(direction: 1 | -1) {
		const strip = stripRef.current
		if (!strip) return
		strip.scrollBy({ left: direction * strip.clientWidth * 0.8, behavior: getScrollBehavior() })
	}

	function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
		if (event.pointerType !== "mouse" || event.button !== 0) return
		dragRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startScroll: event.currentTarget.scrollLeft,
			moved: false,
		}
	}

	function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
		const drag = dragRef.current
		if (!drag || drag.pointerId !== event.pointerId) return
		const deltaX = event.clientX - drag.startX
		if (!drag.moved && Math.abs(deltaX) < dragThreshold) return
		if (!drag.moved) {
			drag.moved = true
			event.currentTarget.setPointerCapture(event.pointerId)
			event.currentTarget.dataset.dragging = ""
		}
		event.currentTarget.scrollLeft = drag.startScroll - deltaX
	}

	function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
		const drag = dragRef.current
		if (!drag || drag.pointerId !== event.pointerId) return
		dragRef.current = null
		if (!drag.moved) return
		suppressClickRef.current = true
		delete event.currentTarget.dataset.dragging
		snapToNearestSlide(event.currentTarget)
	}

	function handleClickCapture(event: React.MouseEvent<HTMLDivElement>) {
		if (!suppressClickRef.current) return
		suppressClickRef.current = false
		event.preventDefault()
		event.stopPropagation()
	}

	const arrowClass =
		"absolute top-[calc(50%-14px)] z-[1] -translate-y-1/2 opacity-0 shadow-lift transition-opacity duration-150 group-hover/strip:opacity-100 focus-visible:opacity-100 disabled:opacity-0! max-sm:hidden"

	return (
		<div className="group/strip relative">
			<div
				ref={stripRef}
				className={cn(
					"relative flex snap-x snap-mandatory gap-3.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] data-[dragging]:cursor-grabbing data-[dragging]:snap-none data-[dragging]:select-none max-sm:-mr-5 max-sm:pr-5",
					className,
				)}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerEnd}
				onPointerCancel={handlePointerEnd}
				onClickCapture={handleClickCapture}
			>
				{children}
			</div>
			<Button
				variant="secondary"
				size="icon-sm"
				className={cn(arrowClass, "left-3")}
				aria-label={marketplaceCopy.previousScreenshot}
				disabled={edges.atStart}
				onClick={() => scrollByPage(-1)}
			>
				<ChevronLeft aria-hidden="true" />
			</Button>
			<Button
				variant="secondary"
				size="icon-sm"
				className={cn(arrowClass, "right-3")}
				aria-label={marketplaceCopy.nextScreenshot}
				disabled={edges.atEnd}
				onClick={() => scrollByPage(1)}
			>
				<ChevronRight aria-hidden="true" />
			</Button>
		</div>
	)
}

function Screenshots({ item }: { item: MarketplaceItem }) {
	const shotClass =
		"relative m-0 h-[360px] min-w-0 flex-[1_0_0] snap-start rounded-[22px] bg-cell p-[22px] max-sm:h-60 max-sm:flex-[0_0_86%] max-sm:p-3.5"
	const captionClass =
		"absolute bottom-[-28px] left-[22px] text-[13px] leading-none font-medium text-text-muted"
	const screenshotAlt = (index: number) => `${item.name} screenshot ${index + 1}`

	if (item.kind === "themes" && item.palettes.length > 0) {
		return (
			<ScreenshotStrip className="pb-7">
				{item.palettes.map((palette) => (
					<figure key={palette.label} className={shotClass}>
						<ThemeWindow palette={palette} size="shot" />
						<figcaption className={captionClass}>{palette.label}</figcaption>
					</figure>
				))}
				{item.screenshots.map((url, index) => (
					<ScreenshotFigure key={url} url={url} alt={screenshotAlt(index)} single={false} />
				))}
			</ScreenshotStrip>
		)
	}

	if (item.screenshots.length === 1 && item.screenshots[0]) {
		return <ScreenshotFigure url={item.screenshots[0]} alt={screenshotAlt(0)} single />
	}

	if (item.screenshots.length > 1) {
		return (
			<ScreenshotStrip className="pb-2">
				{item.screenshots.map((url, index) => (
					<ScreenshotFigure key={url} url={url} alt={screenshotAlt(index)} single={false} />
				))}
			</ScreenshotStrip>
		)
	}

	if (item.coverImageUrl) {
		return (
			<figure className="m-0 overflow-hidden rounded-[22px] bg-cell">
				<img
					className="aspect-[16/9] w-full object-cover"
					src={item.coverImageUrl}
					width={1280}
					height={720}
					alt={`${item.name} in Cortex`}
					loading="lazy"
					decoding="async"
					referrerPolicy="no-referrer"
				/>
			</figure>
		)
	}

	return null
}

export function MarketplaceDetailPage({
	item,
	isStale,
	comments,
	readme,
}: {
	item: MarketplaceItem
	isStale: boolean
	comments: DiscussionCommentsResult | null
	readme: MarketplaceReadme | null
}) {
	const screenshots = <Screenshots item={item} />
	const hasScreenshots =
		(item.kind === "themes" && item.palettes.length > 0) ||
		item.screenshots.length > 0 ||
		Boolean(item.coverImageUrl)
	const hasPrimaryContent = hasScreenshots || item.kind === "plugins"
	const repoUrl = `https://github.com/${item.repo}`
	const sectionTitle = "mb-3.5 text-[20px] leading-[1.25] font-semibold tracking-[-0.015em]"

	return (
		<div className="mx-auto w-[min(1180px,calc(100%-64px))] pt-16 max-sm:w-[calc(100%-40px)] max-sm:pt-9">
			<a
				className="inline-flex h-[34px] items-center gap-1 rounded-full pr-3.5 pl-2 text-[14px] leading-none font-medium text-text-secondary outline-none hover:bg-bg-hover hover:text-text-primary focus-visible:shadow-focus max-sm:h-10"
				href="/marketplace/browse"
			>
				<ChevronLeft className="size-[17px]" aria-hidden="true" />
				{marketplaceCopy.back}
			</a>

			{isStale ? <StaleNotice /> : null}

			<header className="mt-6 grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-6 max-[1000px]:grid-cols-[auto_minmax(0,1fr)] max-sm:gap-4">
				<span
					className="inline-flex size-[88px] items-center justify-center rounded-[26px] bg-[radial-gradient(90%_90%_at_50%_0%,var(--tone),var(--site-cell))] text-text-primary shadow-ring max-sm:size-16 max-sm:rounded-[19px]"
					style={{ "--tone": itemTone(item) } as React.CSSProperties}
				>
					<ItemGlyph item={item} className="size-[38px] max-sm:size-7" />
				</span>
				<div className="min-w-0">
					<h1 className="mt-1 mb-1.5 flex flex-wrap items-center gap-2.5 text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] max-sm:text-[30px]">
						{item.name}
						{item.verified ? (
							<BadgeCheck
								className="size-6 text-brand-text"
								aria-label={marketplaceCopy.verified}
							/>
						) : null}
					</h1>
					<span className="text-[13.5px] leading-[1.3] text-text-muted">
						{marketplaceKindLabels[item.kind].singular} by{" "}
						{item.authorUrl ? (
							<a
								className="underline-offset-[3px] hover:underline"
								href={item.authorUrl}
								target="_blank"
								rel="noopener noreferrer"
							>
								{item.author}
							</a>
						) : (
							item.author
						)}
					</span>
					<p className="mt-3 max-w-[600px] text-[17px] leading-[1.55] text-pretty text-text-secondary max-sm:text-[16px]">
						{item.description}
					</p>
				</div>
				<div className="flex items-center gap-2.5 pt-1.5 max-[1000px]:col-span-full max-sm:flex-col-reverse max-sm:items-stretch">
					<VotePopover item={item} />
					<InstallPopover item={item} />
				</div>
			</header>
			<small className="mt-3.5 ml-28 block text-[13px] leading-[1.4] text-text-muted max-[1000px]:ml-0">
				{marketplaceCopy.opens}{" "}
				<a
					className="text-text-secondary underline underline-offset-[3px] hover:text-text-primary"
					href="/#download"
				>
					{marketplaceCopy.install.getCortex}
				</a>
			</small>

			<div className="mt-11 grid grid-cols-[minmax(0,1fr)_300px] gap-12 border-sep border-t pt-9 max-[1000px]:grid-cols-[minmax(0,1fr)] max-[1000px]:gap-8">
				<div className="min-w-0">
					{hasScreenshots ? (
						<section aria-labelledby="marketplace-screenshots">
							<h2 id="marketplace-screenshots" className={sectionTitle}>
								{marketplaceCopy.screenshots}
							</h2>
							{screenshots}
						</section>
					) : null}

					{item.kind === "plugins" ? (
						<section
							className={hasScreenshots ? "mt-10" : undefined}
							aria-labelledby="marketplace-permissions"
						>
							<h2 id="marketplace-permissions" className={sectionTitle}>
								{marketplaceCopy.permissions}
							</h2>
							{item.capabilities === null ? (
								<p className="text-[14px] leading-normal text-text-secondary">
									{marketplaceCopy.missingCapabilities}
								</p>
							) : item.capabilities.length === 0 ? (
								<p className="text-[14px] leading-normal text-text-secondary">
									{marketplaceCopy.noPermissions}
								</p>
							) : (
								<>
									<ul className="grid overflow-hidden rounded-2xl bg-bg-elevated shadow-ring">
										{item.capabilities.map((capability) => (
											<li
												key={capability}
												className="flex items-center gap-3 border-sep border-t px-4 py-3 text-[14.5px] leading-[1.4] first:border-t-0 max-sm:flex-wrap max-sm:gap-x-3 max-sm:gap-y-1"
											>
												<Shield
													className="size-[17px] shrink-0 text-text-muted"
													aria-hidden="true"
												/>
												<span className="flex-1">{getCapabilityLabel(capability)}</span>
												<code className="font-mono text-[12.5px] leading-none text-text-muted max-sm:basis-full max-sm:pl-[29px]">
													{capability}
												</code>
											</li>
										))}
									</ul>
									<p className="mt-3 text-[13.5px] leading-normal text-text-muted">
										{marketplaceCopy.permissionsNote}
									</p>
								</>
							)}
						</section>
					) : null}

					{readme ? (
						<section
							className={hasPrimaryContent ? "mt-10" : undefined}
							aria-labelledby="marketplace-readme"
						>
							<h2 id="marketplace-readme" className={sectionTitle}>
								{marketplaceCopy.readme}
							</h2>
							<RenderedMarkdown
								className="markdown-surface docs-markdown rounded-2xl bg-bg-elevated px-6 py-5 shadow-ring max-sm:px-4 [&>:first-child]:mt-0 [&>:last-child]:mb-0"
								html={readme.html}
							/>
						</section>
					) : null}

					{comments ? (
						<MarketplaceComments
							item={item}
							comments={comments}
							className={hasPrimaryContent || readme ? "mt-10" : undefined}
						/>
					) : null}
				</div>

				<aside aria-label={marketplaceCopy.information}>
					<dl className="m-0 overflow-hidden rounded-2xl bg-bg-elevated shadow-ring">
						{getInfoRows(item).map(([label, value]) => (
							<div
								key={label}
								className="flex justify-between gap-3 border-sep border-t px-4 py-3 text-[14px] leading-[1.4] first:border-t-0"
							>
								<dt className="text-text-secondary">{label}</dt>
								<dd className="m-0 text-right tabular-nums [overflow-wrap:anywhere]">{value}</dd>
							</div>
						))}
					</dl>
					<div className="mt-3 flex flex-col">
						<SideLink href={repoUrl} icon={<Github aria-hidden="true" />}>
							{item.repo}
						</SideLink>
						<SideLink href={`${repoUrl}#readme`} icon={<BookOpen aria-hidden="true" />}>
							{marketplaceCopy.readme}
						</SideLink>
						<SideLink
							href={reportProblemUrl}
							icon={<Flag aria-hidden="true" />}
							onClick={() =>
								trackEvent({ name: "marketplace_report_clicked", kind: item.kind, id: item.id })
							}
						>
							{marketplaceCopy.report}
						</SideLink>
					</div>
				</aside>
			</div>

			<SubmitBanner />
		</div>
	)
}
