import { cn } from "@cortex/ui/lib/utils"
import { ArrowUpRight, BadgeCheck, BookOpen, ChevronLeft, Flag, Github, Shield } from "lucide-react"
import type React from "react"
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
				single ? "w-full" : "h-[360px] flex-[0_0_auto] max-sm:h-60 max-sm:flex-[0_0_86%]",
			)}
		>
			<a
				className="block h-full rounded-[22px] outline-none focus-visible:shadow-focus"
				href={url}
				target="_blank"
				rel="noopener noreferrer"
			>
				<img
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

function Screenshots({ item }: { item: MarketplaceItem }) {
	const shotClass =
		"relative m-0 h-[360px] min-w-0 flex-[1_0_0] rounded-[22px] bg-cell p-[22px] max-sm:h-60 max-sm:flex-[0_0_86%] max-sm:p-3.5"
	const captionClass =
		"absolute bottom-[-28px] left-[22px] text-[13px] leading-none font-medium text-text-muted"
	const stripClass =
		"flex gap-3.5 overflow-x-auto pb-7 [scrollbar-width:none] max-sm:-mr-5 max-sm:pr-5"
	const screenshotAlt = (index: number) => `${item.name} screenshot ${index + 1}`

	if (item.kind === "themes" && item.palettes.length > 0) {
		return (
			<div className={stripClass}>
				{item.palettes.map((palette) => (
					<figure key={palette.label} className={shotClass}>
						<ThemeWindow palette={palette} size="shot" />
						<figcaption className={captionClass}>{palette.label}</figcaption>
					</figure>
				))}
				{item.screenshots.map((url, index) => (
					<ScreenshotFigure key={url} url={url} alt={screenshotAlt(index)} single={false} />
				))}
			</div>
		)
	}

	if (item.screenshots.length === 1 && item.screenshots[0]) {
		return <ScreenshotFigure url={item.screenshots[0]} alt={screenshotAlt(0)} single />
	}

	if (item.screenshots.length > 1) {
		return (
			<div className={cn(stripClass, "pb-2")}>
				{item.screenshots.map((url, index) => (
					<ScreenshotFigure key={url} url={url} alt={screenshotAlt(index)} single={false} />
				))}
			</div>
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
							<div
								className="markdown-surface docs-markdown rounded-2xl bg-bg-elevated px-6 py-5 shadow-ring max-sm:px-4 [&>:first-child]:mt-0 [&>:last-child]:mb-0"
								// biome-ignore lint/security/noDangerouslySetInnerHtml: README HTML is sanitized by renderReleaseMarkdown on the server.
								dangerouslySetInnerHTML={{ __html: readme.html }}
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
