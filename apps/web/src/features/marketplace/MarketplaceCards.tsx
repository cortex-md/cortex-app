import { formatCount } from "@cortex/marketplace/catalog"
import { BadgeCheck, Download, Star, ThumbsUp } from "lucide-react"
import type { MarketplaceCatalogItem } from "../../server/marketplace"

export function MarketplaceArtwork({
	item,
	size = "md",
}: {
	item: MarketplaceCatalogItem
	size?: "md" | "lg"
}) {
	const dimension =
		size === "lg" ? "size-16 rounded-2xl text-[26px]" : "size-11 rounded-xl text-[18px]"
	return (
		<span
			className={`grid shrink-0 place-items-center overflow-hidden bg-bg-secondary font-semibold text-text-muted shadow-[0_0_0_1px_var(--border-subtle)] ${dimension}`}
			aria-hidden="true"
		>
			{item.entry.coverImageUrl ? (
				<img
					className="size-full object-cover"
					src={item.entry.coverImageUrl}
					alt=""
					loading="lazy"
				/>
			) : (
				item.entry.name.charAt(0).toUpperCase()
			)}
		</span>
	)
}

export function VerifiedBadge() {
	return (
		<BadgeCheck
			className="inline size-4 shrink-0 align-[-2px] text-brand-text"
			aria-label="Verified by Cortex"
		/>
	)
}

export function MarketplaceStatLine({ item }: { item: MarketplaceCatalogItem }) {
	if (!item.stats) return null
	return (
		<span className="flex items-center gap-3 text-[12px] leading-5 text-text-muted tabular-nums">
			<span className="inline-flex items-center gap-1" title="Votes on GitHub">
				<ThumbsUp className="size-3" aria-hidden="true" />
				{formatCount(item.stats.votes)}
			</span>
			<span className="inline-flex items-center gap-1" title="Downloads">
				<Download className="size-3" aria-hidden="true" />
				{formatCount(item.stats.downloads)}
			</span>
			<span className="inline-flex items-center gap-1" title="GitHub stars">
				<Star className="size-3" aria-hidden="true" />
				{formatCount(item.stats.stars)}
			</span>
		</span>
	)
}

export function MarketplaceCard({ item }: { item: MarketplaceCatalogItem }) {
	return (
		<a
			className="group flex min-h-[148px] flex-col gap-3 rounded-2xl bg-bg-secondary/40 p-5 shadow-[0_0_0_1px_var(--border-subtle)] transition-colors hover:bg-bg-secondary"
			href={`/marketplace/${item.kind}/${item.entry.id}`}
		>
			<div className="flex items-start gap-3">
				<MarketplaceArtwork item={item} />
				<div className="min-w-0">
					<p className="m-0 flex items-center gap-1.5 truncate text-[15px] leading-6 font-semibold text-text-primary">
						<span className="truncate">{item.entry.name}</span>
						{item.verified && <VerifiedBadge />}
					</p>
					<p className="m-0 truncate text-[13px] leading-5 text-text-muted">{item.entry.author}</p>
				</div>
			</div>
			<p className="m-0 line-clamp-2 text-[14px] leading-6 text-text-secondary">
				{item.entry.description}
			</p>
			<div className="mt-auto">
				<MarketplaceStatLine item={item} />
			</div>
		</a>
	)
}
