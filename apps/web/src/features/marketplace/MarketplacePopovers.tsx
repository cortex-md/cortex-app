import { Button } from "@cortex/ui/button"
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverTitle,
	PopoverTrigger,
} from "@cortex/ui/popover"
import { ArrowBigUp, Github } from "lucide-react"
import { useState } from "react"
import {
	cortexAppUrl,
	getMarketplaceInstallUrl,
	marketplaceDeepLinksSupported,
} from "../../config/deepLinks"
import { marketplaceCopy, registryDiscussionsUrl } from "../../content/marketplace"
import { trackEvent } from "../../lib/analytics"
import type { MarketplaceItem } from "../../server/marketplace"
import { formatCount } from "./marketplaceModel"

const popoverClass =
	"flex w-80 flex-col gap-1.5 rounded-[20px] border-0 bg-bg-elevated p-[18px] text-text-primary shadow-[var(--site-ring),0_24px_48px_-18px_rgba(28,25,23,0.35)] max-sm:w-[calc(100vw-40px)]"

export function VotePopover({ item }: { item: MarketplaceItem }) {
	const [open, setOpen] = useState(false)
	const href = item.discussionUrl ?? registryDiscussionsUrl

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="secondary"
					size="lg"
					className="max-sm:w-full"
					onClick={() =>
						trackEvent({ name: "marketplace_vote_clicked", kind: item.kind, id: item.id })
					}
				>
					<ArrowBigUp aria-hidden="true" />
					{marketplaceCopy.vote.label}
					<b className="ml-1 border-sep border-l pl-2.5 font-semibold tabular-nums">
						<span className="sr-only">, </span>
						{formatCount(item.votes)}
						<span className="sr-only"> votes</span>
					</b>
				</Button>
			</PopoverTrigger>
			<PopoverContent className={popoverClass} align="end" sideOffset={10}>
				<PopoverTitle className="text-[15px] leading-[1.3] font-semibold">
					{marketplaceCopy.vote.title}
				</PopoverTitle>
				<PopoverDescription className="text-[14px] leading-normal text-text-secondary">
					{item.discussionUrl
						? marketplaceCopy.vote.body(item.name)
						: marketplaceCopy.vote.bodyWithoutDiscussion}
				</PopoverDescription>
				<div className="mt-2.5 flex justify-end gap-2">
					<Button variant="ghost" onClick={() => setOpen(false)}>
						{marketplaceCopy.vote.dismiss}
					</Button>
					<Button asChild>
						<a href={href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
							<Github aria-hidden="true" />
							{marketplaceCopy.vote.cta}
						</a>
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	)
}

export function getInstallLabel(item: MarketplaceItem) {
	return item.kind === "themes" ? "Install theme" : "Install"
}

export function InstallPopover({ item }: { item: MarketplaceItem }) {
	const label = getInstallLabel(item)

	if (marketplaceDeepLinksSupported) {
		return (
			<Button size="lg" className="max-sm:w-full" asChild>
				<a
					href={getMarketplaceInstallUrl(item.kind, item.id)}
					onClick={() =>
						trackEvent({ name: "marketplace_install_opened", kind: item.kind, id: item.id })
					}
				>
					{label}
				</a>
			</Button>
		)
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					size="lg"
					className="max-sm:w-full"
					onClick={() =>
						trackEvent({ name: "marketplace_install_opened", kind: item.kind, id: item.id })
					}
				>
					{label}
				</Button>
			</PopoverTrigger>
			<PopoverContent className={popoverClass} align="end" sideOffset={10}>
				<PopoverTitle className="text-[15px] leading-[1.3] font-semibold">
					{marketplaceCopy.install.title}
				</PopoverTitle>
				<p className="rounded-xl bg-cell px-3 py-2.5 text-[14px] leading-[1.4] font-medium">
					{marketplaceCopy.install.steps(item.name)}
				</p>
				<PopoverDescription className="text-[14px] leading-normal text-text-secondary">
					{marketplaceCopy.install.body}
				</PopoverDescription>
				<div className="mt-2.5 flex items-center justify-between gap-2">
					<a
						className="rounded-md text-[13.5px] leading-none font-medium text-text-secondary underline-offset-[3px] outline-none hover:text-text-primary hover:underline focus-visible:shadow-focus"
						href="/#download"
					>
						{marketplaceCopy.install.getCortex}
					</a>
					<Button asChild>
						<a href={cortexAppUrl}>{marketplaceCopy.install.openCortex}</a>
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	)
}
