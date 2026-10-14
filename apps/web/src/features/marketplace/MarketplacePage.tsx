import { formatStatsAge, matchesEntry } from "@cortex/marketplace/catalog"
import { Search } from "lucide-react"
import { useMemo, useState } from "react"
import type {
	MarketplaceCatalog,
	MarketplaceCatalogItem,
	MarketplaceKindParam,
} from "../../server/marketplace"
import { LandingFooter } from "../landing/sections/LandingFooter"
import { SiteHeader } from "../site/SiteHeader"
import { MarketplaceCard } from "./MarketplaceCards"

export type MarketplaceSort = "popular" | "downloads" | "name"

export const marketplaceSortOptions: { value: MarketplaceSort; label: string }[] = [
	{ value: "popular", label: "Most voted" },
	{ value: "downloads", label: "Most downloaded" },
	{ value: "name", label: "Name" },
]

interface MarketplacePageProps {
	catalog: MarketplaceCatalog
	tab: MarketplaceKindParam
	sort: MarketplaceSort
}

function sortItems(items: MarketplaceCatalogItem[], sort: MarketplaceSort) {
	if (sort === "name") return [...items].sort((a, b) => a.entry.name.localeCompare(b.entry.name))
	const field = sort === "popular" ? "votes" : "downloads"
	return [...items].sort(
		(a, b) =>
			(b.stats?.[field] ?? 0) - (a.stats?.[field] ?? 0) || a.entry.name.localeCompare(b.entry.name),
	)
}

function TabLink({
	active,
	href,
	label,
	count,
}: {
	active: boolean
	href: string
	label: string
	count: number
}) {
	return (
		<a
			aria-current={active ? "page" : undefined}
			className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition-colors ${
				active ? "bg-text-primary text-background" : "text-text-secondary hover:bg-bg-secondary"
			}`}
			href={href}
		>
			{label}
			<span className="tabular-nums opacity-70">{count}</span>
		</a>
	)
}

export function MarketplacePage({ catalog, tab, sort }: MarketplacePageProps) {
	const [query, setQuery] = useState("")
	const items = useMemo(
		() =>
			sortItems(
				catalog[tab].filter((item) => matchesEntry(item.entry, query)),
				sort,
			),
		[catalog, tab, query, sort],
	)
	const statsAge = formatStatsAge(catalog.generatedAt)

	return (
		<div className="min-h-screen bg-background text-foreground">
			<SiteHeader homeHrefPrefix="/" surface="marketplace" />
			<main id="main-content" tabIndex={-1}>
				<section className="mx-auto w-[min(1180px,calc(100%_-_64px))] pt-[140px] pb-24 max-lg:w-[min(calc(100%_-_48px),940px)] max-md:w-[min(calc(100%_-_36px),720px)] max-md:pt-[124px] max-sm:w-[min(calc(100%_-_28px),520px)] max-sm:pt-[108px]">
					<div className="grid max-w-[780px] gap-4">
						<p className="m-0 text-[15px] leading-6 font-medium text-text-muted">Marketplace</p>
						<h1 className="m-0 max-w-[760px] text-balance text-[clamp(38px,5vw,64px)] leading-[1.02] font-semibold tracking-[-0.025em] text-text-primary">
							Community plugins and themes for Cortex.
						</h1>
						<p className="m-0 max-w-[620px] text-pretty text-[17px] leading-7 text-text-secondary">
							Install them from Cortex → Marketplace. Votes are 👍 reactions on GitHub, downloads
							come from each GitHub release, and every release is scanned automatically.
						</p>
						{statsAge && (
							<p className="m-0 text-[13px] leading-5 font-medium text-text-muted">{statsAge}</p>
						)}
					</div>

					<div className="mt-12 flex flex-wrap items-center justify-between gap-4">
						<nav className="flex items-center gap-1" aria-label="Marketplace categories">
							<TabLink
								active={tab === "plugins"}
								count={catalog.plugins.length}
								href={`/marketplace?tab=plugins&sort=${sort}`}
								label="Plugins"
							/>
							<TabLink
								active={tab === "themes"}
								count={catalog.themes.length}
								href={`/marketplace?tab=themes&sort=${sort}`}
								label="Themes"
							/>
						</nav>
						<div className="flex flex-wrap items-center gap-3">
							<label className="relative flex items-center">
								<Search
									className="pointer-events-none absolute left-3 size-4 text-text-muted"
									aria-hidden="true"
								/>
								<input
									className="h-9 w-[240px] rounded-full bg-bg-secondary pr-4 pl-9 text-[14px] text-text-primary outline-none placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-border-focus max-sm:w-full"
									onChange={(event) => setQuery(event.target.value)}
									placeholder={`Search ${tab}`}
									type="search"
									value={query}
								/>
							</label>
							<nav className="flex items-center gap-1" aria-label="Sort">
								{marketplaceSortOptions.map((option) => (
									<a
										aria-current={option.value === sort ? "true" : undefined}
										className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${
											option.value === sort
												? "bg-bg-secondary text-text-primary"
												: "text-text-muted hover:text-text-primary"
										}`}
										href={`/marketplace?tab=${tab}&sort=${option.value}`}
										key={option.value}
									>
										{option.label}
									</a>
								))}
							</nav>
						</div>
					</div>

					{catalog.status === "unavailable" ? (
						<p className="mt-16 text-[15px] text-text-muted">
							The Marketplace is unavailable right now. Try again in a few minutes.
						</p>
					) : items.length === 0 ? (
						<p className="mt-16 text-[15px] text-text-muted">No {tab} match your search.</p>
					) : (
						<div className="mt-8 grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
							{items.map((item) => (
								<MarketplaceCard item={item} key={item.entry.id} />
							))}
						</div>
					)}
					{catalog.isStale && (
						<p className="mt-6 text-[13px] text-text-muted">
							Showing cached data while GitHub is unavailable.
						</p>
					)}
				</section>
			</main>
			<LandingFooter homeHrefPrefix="/" />
		</div>
	)
}
