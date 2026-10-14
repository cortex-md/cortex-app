import {
	formatCount,
	formatStatsAge,
	getRepositoryLabel,
	getRepositoryUrl,
} from "@cortex/marketplace/catalog"
import { ArrowLeft, ArrowUpRight, ShieldAlert, ThumbsUp, TriangleAlert } from "lucide-react"
import type { ReactNode } from "react"
import { trackLandingEvent } from "../../lib/analytics"
import type { MarketplaceItemPage as MarketplaceItemPageData } from "../../server/marketplace"
import { LandingFooter } from "../landing/sections/LandingFooter"
import { SiteHeader } from "../site/SiteHeader"
import { MarketplaceArtwork, VerifiedBadge } from "./MarketplaceCards"

function formatDate(value: string | undefined): string | null {
	if (!value) return null
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return null
	return date.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-4 border-border-subtle border-b py-3 text-[14px] last:border-b-0">
			<dt className="text-text-muted">{label}</dt>
			<dd className="m-0 text-right font-medium text-text-primary tabular-nums">{children}</dd>
		</div>
	)
}

export function MarketplaceItemPage({ page }: { page: MarketplaceItemPageData }) {
	const { item, readmeHtml, generatedAt } = page
	const kindLabel = item.kind === "plugins" ? "plugin" : "theme"
	const voteUrl = item.stats?.discussion?.url ?? null
	const audit = item.stats?.audit
	const statsAge = formatStatsAge(generatedAt)

	return (
		<div className="min-h-screen bg-background text-foreground">
			<SiteHeader homeHrefPrefix="/" surface="marketplace" />
			<main id="main-content" tabIndex={-1}>
				<section className="mx-auto w-[min(1180px,calc(100%_-_64px))] pt-[132px] pb-24 max-lg:w-[min(calc(100%_-_48px),940px)] max-md:w-[min(calc(100%_-_36px),720px)] max-sm:w-[min(calc(100%_-_28px),520px)]">
					<a
						className="inline-flex items-center gap-1.5 text-[14px] font-medium text-text-muted hover:text-text-primary"
						href={`/marketplace?tab=${item.kind}`}
					>
						<ArrowLeft className="size-4" aria-hidden="true" />
						Marketplace
					</a>

					<header className="mt-8 flex flex-wrap items-start gap-5">
						<MarketplaceArtwork item={item} size="lg" />
						<div className="min-w-0 flex-1">
							<h1 className="m-0 flex items-center gap-2 text-[clamp(30px,4vw,44px)] leading-[1.08] font-semibold tracking-[-0.02em] text-text-primary">
								{item.entry.name}
								{item.verified && <VerifiedBadge />}
							</h1>
							<p className="mt-2 mb-0 text-[15px] text-text-muted">
								{item.entry.authorUrl ? (
									<a
										className="hover:text-text-primary hover:underline"
										href={item.entry.authorUrl}
									>
										{item.entry.author}
									</a>
								) : (
									item.entry.author
								)}{" "}
								· Cortex {kindLabel}
							</p>
							<p className="mt-4 mb-0 max-w-[680px] text-pretty text-[17px] leading-7 text-text-secondary">
								{item.entry.description}
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							{voteUrl && (
								<a
									className="inline-flex h-10 items-center gap-2 rounded-full bg-text-primary px-5 text-[14px] font-medium text-background"
									href={voteUrl}
									onClick={() =>
										trackLandingEvent({
											name: "marketplace_vote_clicked",
											kind: item.kind,
											id: item.entry.id,
										})
									}
									rel="noreferrer"
									target="_blank"
								>
									<ThumbsUp className="size-4" aria-hidden="true" />
									Vote on GitHub
								</a>
							)}
							<a
								className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-[14px] font-medium text-text-secondary shadow-[0_0_0_1px_var(--border-strong)] hover:text-text-primary"
								href="/#downloads"
							>
								Get Cortex
							</a>
						</div>
					</header>

					{item.pulledVersions.length > 0 && (
						<p className="mt-8 flex items-start gap-2 rounded-xl bg-bg-secondary p-4 text-[14px] text-text-secondary">
							<TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
							Version {item.pulledVersions.join(", ")} was pulled from the Marketplace:{" "}
							{item.pulledReason}
						</p>
					)}
					{audit && audit.status !== "pass" && (
						<p className="mt-4 flex items-start gap-2 rounded-xl bg-bg-secondary p-4 text-[14px] text-text-secondary">
							<ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
							{audit.status === "fail"
								? `The automated review flagged ${audit.checkedTag}; maintainers are reviewing it.`
								: `The automated review found warnings in ${audit.checkedTag}.`}
						</p>
					)}

					<div className="mt-12 grid grid-cols-[minmax(0,1fr)_300px] gap-16 max-lg:grid-cols-1 max-lg:gap-10">
						<article className="min-w-0">
							{readmeHtml ? (
								<div
									className="markdown-surface docs-markdown changelog-markdown"
									// biome-ignore lint/security/noDangerouslySetInnerHtml: README markdown is rendered and hardened server-side
									dangerouslySetInnerHTML={{ __html: readmeHtml }}
								/>
							) : (
								<p className="text-[15px] text-text-muted">No README available.</p>
							)}
						</article>
						<aside className="self-start lg:sticky lg:top-28">
							<dl className="m-0 rounded-2xl p-5 shadow-[0_0_0_1px_var(--border-subtle)]">
								<InfoRow label="Votes">{formatCount(item.stats?.votes)}</InfoRow>
								<InfoRow label="Downloads">{formatCount(item.stats?.downloads)}</InfoRow>
								<InfoRow label="GitHub stars">{formatCount(item.stats?.stars)}</InfoRow>
								{item.stats?.latest && <InfoRow label="Version">{item.stats.latest}</InfoRow>}
								{formatDate(item.stats?.releasedAt) && (
									<InfoRow label="Released">{formatDate(item.stats?.releasedAt)}</InfoRow>
								)}
								<InfoRow label="Source">
									<a
										className="inline-flex items-center gap-1 hover:underline"
										href={getRepositoryUrl(item.entry.repo)}
										rel="noreferrer"
										target="_blank"
									>
										{getRepositoryLabel(item.entry.repo)}
										<ArrowUpRight className="size-3.5" aria-hidden="true" />
									</a>
								</InfoRow>
							</dl>
							<p className="mt-4 text-[13px] leading-5 text-text-muted">
								Install it from Cortex → Marketplace →{" "}
								{item.kind === "plugins" ? "Plugins" : "Themes"}.{statsAge ? ` ${statsAge}.` : ""}
							</p>
						</aside>
					</div>
				</section>
			</main>
			<LandingFooter homeHrefPrefix="/" />
		</div>
	)
}
