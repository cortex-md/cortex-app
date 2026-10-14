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
import type { MarketplaceItem } from "../../server/marketplace"
import { ItemGlyph, itemTone, TemplatePreview, ThemeWindow } from "./MarketplaceArt"
import { StaleNotice, SubmitBanner } from "./MarketplaceBits"
import { InstallPopover, VotePopover } from "./MarketplacePopovers"
import { formatCount, formatDate } from "./marketplaceModel"

function getOpensNote(item: MarketplaceItem) {
	if (item.source === "community") return marketplaceCopy.opens.community
	if (item.kind === "templates") return marketplaceCopy.opens.builtInTemplate
	return item.kind === "themes"
		? marketplaceCopy.opens.builtInTheme
		: marketplaceCopy.opens.builtInPlugin
}

function getInfoRows(item: MarketplaceItem): Array<[string, string]> {
	const requires = item.minAppVersion ? `Cortex ${item.minAppVersion} or later` : null
	const rows: Array<[string, string | null]> =
		item.source === "community"
			? [
					["Votes", formatCount(item.votes)],
					["Downloads", formatCount(item.downloads)],
					["Version", item.version],
					["Updated", formatDate(item.releasedAt)],
					...(item.kind === "themes"
						? [["Appearance", item.appearance] as [string, string | null]]
						: []),
					["Requires", requires],
				]
			: item.kind === "plugins"
				? [
						["Version", item.version],
						["Distribution", marketplaceCopy.builtIn],
						["Requires", requires],
					]
				: item.kind === "themes"
					? [
							["Appearance", item.appearance],
							["Distribution", marketplaceCopy.builtIn],
						]
					: [
							["Views", item.template?.views.join(", ") ?? null],
							["Properties", item.template ? String(item.template.properties.length) : null],
							["Distribution", marketplaceCopy.builtIn],
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

function Screenshots({ item }: { item: MarketplaceItem }) {
	const shotClass =
		"relative m-0 h-[360px] min-w-0 flex-[1_0_0] rounded-[22px] bg-cell p-[22px] max-sm:h-60 max-sm:flex-[0_0_86%] max-sm:p-3.5"
	const captionClass =
		"absolute bottom-[-28px] left-[22px] text-[13px] leading-none font-medium text-text-muted"

	if (item.kind === "themes" && item.palettes.length > 0) {
		return (
			<div className="flex gap-3.5 overflow-x-auto pb-7 [scrollbar-width:none] max-sm:-mr-5 max-sm:pr-5">
				{item.palettes.map((palette) => (
					<figure key={palette.label} className={shotClass}>
						<ThemeWindow palette={palette} size="shot" />
						<figcaption className={captionClass}>{palette.label}</figcaption>
					</figure>
				))}
			</div>
		)
	}

	if (item.kind === "templates" && item.template) {
		const firstView = item.template.views[0] ?? ""
		const caption = firstView === "Table" && item.template.art === "board" ? "Board" : firstView
		return (
			<div className="flex pb-7">
				<figure
					className={cn(shotClass, "flex h-auto items-start max-sm:h-auto max-sm:flex-[1_0_100%]")}
				>
					<TemplatePreview template={item.template} size="shot" />
					<figcaption className={captionClass}>{caption}</figcaption>
				</figure>
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
}: {
	item: MarketplaceItem
	isStale: boolean
}) {
	const screenshots = <Screenshots item={item} />
	const hasScreenshots =
		(item.kind === "themes" && item.palettes.length > 0) ||
		(item.kind === "templates" && item.template !== null) ||
		Boolean(item.coverImageUrl)
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
					{item.source === "community" ? <VotePopover item={item} /> : null}
					<InstallPopover item={item} />
				</div>
			</header>
			<small className="mt-3.5 ml-28 block text-[13px] leading-[1.4] text-text-muted max-[1000px]:ml-0">
				{getOpensNote(item)}{" "}
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

					{item.template ? (
						<section className="mt-10" aria-labelledby="marketplace-properties">
							<h2 id="marketplace-properties" className={sectionTitle}>
								{marketplaceCopy.properties}
							</h2>
							<ul className="grid overflow-hidden rounded-2xl bg-bg-elevated shadow-ring">
								{item.template.properties.map((property) => (
									<li
										key={property.name}
										className="flex items-center gap-3 border-sep border-t px-4 py-3 text-[14.5px] leading-[1.4] first:border-t-0"
									>
										<span className="flex-1">{property.name}</span>
										<em className="text-right text-[13.5px] leading-[1.3] text-text-secondary not-italic">
											{property.type}
										</em>
									</li>
								))}
							</ul>
							<p className="mt-3 text-[13.5px] leading-normal text-text-muted">
								{marketplaceCopy.propertiesNote}
							</p>
						</section>
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
						{item.source === "community" ? (
							<>
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
							</>
						) : null}
					</div>
				</aside>
			</div>

			<SubmitBanner />
		</div>
	)
}
