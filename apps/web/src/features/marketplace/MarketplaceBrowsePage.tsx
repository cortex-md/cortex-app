import { Button } from "@cortex/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@cortex/ui/input-group"
import { NativeSelect, NativeSelectOption } from "@cortex/ui/native-select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@cortex/ui/tabs"
import { Search } from "lucide-react"
import { useEffect, useState } from "react"
import {
	type MarketplaceKind,
	type MarketplaceKindFilter,
	type MarketplaceSort,
	marketplaceCopy,
	marketplaceKindLabels,
	marketplaceKindTabs,
	marketplaceSortOptions,
	publishingGuideUrl,
} from "../../content/marketplace"
import { trackEvent } from "../../lib/analytics"
import type { MarketplaceCatalog } from "../../server/marketplace"
import { MarketplaceUnavailable, StaleNotice, SubmitBanner } from "./MarketplaceBits"
import { MarketplaceCard } from "./MarketplaceCard"
import { countByKind, marketplaceKinds, matchesQuery, sortItems } from "./marketplaceModel"

export interface MarketplaceBrowseSearch {
	kind: MarketplaceKindFilter
	q: string
	sort: MarketplaceSort
}

interface MarketplaceBrowsePageProps {
	catalog: MarketplaceCatalog
	search: MarketplaceBrowseSearch
	onSearchChange: (next: Partial<MarketplaceBrowseSearch>, options?: { replace?: boolean }) => void
}

function useDebouncedQuery(
	query: string,
	onCommit: (value: string) => void,
): [string, (value: string) => void] {
	const [draft, setDraft] = useState(query)

	useEffect(() => setDraft(query), [query])

	useEffect(() => {
		if (draft === query) return
		const timer = window.setTimeout(() => onCommit(draft), 200)
		return () => window.clearTimeout(timer)
	}, [draft, query, onCommit])

	return [draft, setDraft]
}

export function MarketplaceBrowsePage({
	catalog,
	search,
	onSearchChange,
}: MarketplaceBrowsePageProps) {
	const [draft, setDraft] = useDebouncedQuery(search.q, (value) =>
		onSearchChange({ q: value }, { replace: true }),
	)
	const counts = countByKind(catalog.items, search.q)
	const visibleKinds: MarketplaceKind[] = search.kind === "all" ? marketplaceKinds : [search.kind]
	const sections = visibleKinds
		.map((kind) => {
			const items = sortItems(
				catalog.items.filter((item) => item.kind === kind && matchesQuery(item, search.q)),
				search.sort,
			)
			return { kind, items, shown: search.kind === "all" ? items.slice(0, 3) : items }
		})
		.filter((section) => section.items.length > 0)

	function changeKind(kind: MarketplaceKindFilter) {
		onSearchChange({ kind })
		trackEvent({ name: "marketplace_filter_changed", kind, sort: search.sort })
	}

	return (
		<div className="mx-auto w-[min(1180px,calc(100%-64px))] pt-16 max-sm:w-[calc(100%-40px)] max-sm:pt-9">
			<header>
				<h1 className="text-[clamp(36px,4.6vw,56px)] leading-[1.04] font-semibold tracking-[-0.035em] max-sm:text-[38px]">
					{marketplaceCopy.title}
				</h1>
				<p className="mt-3.5 max-w-[560px] text-[17px] leading-[1.6] text-text-secondary max-sm:text-[16.5px]">
					{marketplaceCopy.lead}
				</p>
			</header>

			{catalog.isStale ? <StaleNotice /> : null}

			{catalog.status === "unavailable" ? (
				<MarketplaceUnavailable />
			) : (
				<Tabs
					value={search.kind}
					onValueChange={(value) => changeKind(value as MarketplaceKindFilter)}
				>
					<div className="mt-8 flex items-center gap-2.5 max-sm:mt-6 max-sm:flex-wrap">
						<TabsList
							className="max-sm:w-full max-sm:flex-[1_1_100%] max-sm:justify-start max-sm:overflow-x-auto max-sm:[scrollbar-width:none]"
							aria-label={marketplaceCopy.kindLabel}
						>
							{marketplaceKindTabs.map((tab) => (
								<TabsTrigger
									key={tab.value}
									value={tab.value}
									className="flex-none gap-2 px-4 max-sm:px-3"
								>
									{tab.label}
									<small className="text-[12px] leading-none font-medium text-text-muted tabular-nums">
										{counts[tab.value]}
									</small>
								</TabsTrigger>
							))}
						</TabsList>
						<InputGroup
							variant="search"
							className="h-10 flex-1 border-0 bg-bg-elevated px-4 shadow-ring has-[[data-slot=input-group-control]:focus-visible]:shadow-ring-strong has-[[data-slot=input-group-control]:focus-visible]:ring-0 max-sm:min-w-0 max-sm:flex-[1_1_0]"
						>
							<InputGroupAddon className="text-text-muted">
								<Search className="size-[17px]" aria-hidden="true" />
							</InputGroupAddon>
							<InputGroupInput
								type="search"
								value={draft}
								placeholder={marketplaceCopy.searchPlaceholder}
								aria-label={marketplaceCopy.searchLabel}
								className="text-[15px]"
								onChange={(event) => setDraft(event.target.value)}
							/>
						</InputGroup>
						<div className="inline-flex h-10 items-center gap-1.5 rounded-full bg-bg-elevated pl-4 text-[14px] leading-none font-medium text-text-muted shadow-ring has-[select:focus-visible]:shadow-ring-strong">
							<span className="max-sm:hidden" aria-hidden="true">
								{marketplaceCopy.sortLabel}
							</span>
							<NativeSelect
								aria-label={marketplaceCopy.sortLabel}
								value={search.sort}
								className="h-10 bg-transparent pl-1 font-medium shadow-none hover:bg-transparent focus-visible:shadow-none max-sm:pl-3"
								onChange={(event) => {
									const sort = event.target.value as MarketplaceSort
									onSearchChange({ sort }, { replace: true })
									trackEvent({ name: "marketplace_filter_changed", kind: search.kind, sort })
								}}
							>
								{marketplaceSortOptions.map((option) => (
									<NativeSelectOption key={option.value} value={option.value}>
										{option.label}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</div>
					</div>

					<TabsContent value={search.kind} className="outline-none">
						{sections.map((section) => (
							<section
								key={section.kind}
								className="mt-10"
								aria-label={marketplaceKindLabels[section.kind].plural}
							>
								{search.kind === "all" ? (
									<div className="mb-4 flex items-baseline gap-2.5">
										<h2 className="text-[22px] leading-[1.2] font-semibold tracking-[-0.02em]">
											{marketplaceKindLabels[section.kind].plural}
										</h2>
										<span className="text-[15px] leading-none font-medium text-text-muted">
											{section.items.length}
										</span>
										{section.items.length > 3 ? (
											<Button
												variant="ghost"
												size="sm"
												className="ml-auto text-text-primary"
												onClick={() => changeKind(section.kind)}
											>
												{marketplaceCopy.seeAll}
											</Button>
										) : null}
									</div>
								) : null}
								<div className="grid grid-cols-3 gap-4 max-[1000px]:grid-cols-2 max-sm:grid-cols-1">
									{section.shown.map((item) => (
										<MarketplaceCard key={`${item.kind}/${item.id}`} item={item} />
									))}
								</div>
							</section>
						))}

						{sections.length === 0 ? (
							<div className="mt-12 flex flex-col items-center gap-2 rounded-[22px] px-6 py-12 text-center shadow-[inset_0_0_0_1px_var(--site-sep)]">
								<b className="text-[17px] leading-[1.3] font-semibold">
									{search.q.trim()
										? marketplaceCopy.emptyTitle(search.q)
										: marketplaceCopy.emptyKindTitle(
												search.kind === "all"
													? "plugins or themes"
													: marketplaceKindLabels[search.kind].plural.toLowerCase(),
											)}
								</b>
								<span className="mb-2 max-w-[460px] text-[14px] leading-[1.4] text-text-secondary">
									{search.q.trim() ? marketplaceCopy.emptyBody : marketplaceCopy.emptyKindBody}
								</span>
								{search.q.trim() ? (
									<Button
										variant="secondary"
										onClick={() => {
											setDraft("")
											onSearchChange({ q: "", kind: "all" })
										}}
									>
										{marketplaceCopy.emptyAction}
									</Button>
								) : (
									<Button variant="secondary" asChild>
										<a href={publishingGuideUrl}>{marketplaceCopy.emptyKindAction}</a>
									</Button>
								)}
							</div>
						) : null}
					</TabsContent>
				</Tabs>
			)}

			<SubmitBanner />
		</div>
	)
}
