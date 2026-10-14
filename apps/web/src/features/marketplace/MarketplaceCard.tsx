import { BadgeCheck, Download, ThumbsUp } from "lucide-react"
import { marketplaceCopy } from "../../content/marketplace"
import type { MarketplaceItem } from "../../server/marketplace"
import { CardArt } from "./MarketplaceArt"
import { formatCount, getItemHref } from "./marketplaceModel"

export function MarketplaceCard({ item }: { item: MarketplaceItem }) {
	return (
		<a
			className="group flex flex-col rounded-[22px] bg-bg-elevated p-2 text-left text-text-primary shadow-ring outline-none transition-[box-shadow,translate] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:shadow-ring-strong motion-reduce:hover:translate-y-0"
			href={getItemHref(item)}
		>
			<CardArt item={item} />
			<div className="flex flex-1 flex-col gap-1 px-2.5 pt-3.5 pb-2">
				<b className="flex items-center gap-1.5 text-[17px] leading-[1.25] font-semibold tracking-[-0.01em]">
					{item.name}
					{item.verified ? (
						<BadgeCheck className="size-4 text-brand-text" aria-label={marketplaceCopy.verified} />
					) : null}
				</b>
				<span className="text-[13.5px] leading-[1.3] text-text-muted">{item.author}</span>
				<p className="mt-1 line-clamp-2 text-[14px] leading-normal text-text-secondary">
					{item.description}
				</p>
				<div className="mt-auto flex gap-3.5 pt-3.5 text-[13px] leading-none font-medium text-text-muted tabular-nums">
					{item.source === "community" ? (
						<>
							<span className="inline-flex items-center gap-1.5">
								<ThumbsUp className="size-[15px]" aria-hidden="true" />
								<span className="sr-only">Votes: </span>
								{formatCount(item.votes)}
							</span>
							<span className="inline-flex items-center gap-1.5">
								<Download className="size-[15px]" aria-hidden="true" />
								<span className="sr-only">Downloads: </span>
								{formatCount(item.downloads)}
							</span>
						</>
					) : (
						<span>{marketplaceCopy.builtIn}</span>
					)}
				</div>
			</div>
		</a>
	)
}
