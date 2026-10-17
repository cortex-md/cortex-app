import { Search } from "lucide-react"
import { realWorkGroup } from "../../../../content/landing"

export function SearchMock() {
	const { search } = realWorkGroup

	return (
		<div className="absolute inset-[26px] flex flex-col gap-2 font-app">
			<div className="flex items-center gap-2 rounded-xl bg-bg-elevated px-3 py-2.5 text-[14px] leading-5 shadow-ring">
				<Search className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
				<span className="inline-block w-[6ch] overflow-hidden align-bottom whitespace-nowrap animate-home-search-type motion-reduce:animate-none">
					{search.query}
				</span>
			</div>
			{search.hits.map((hit, index) => (
				<div
					key={`${hit.before}${hit.after}`}
					className="rounded-[10px] bg-bg-elevated px-3 py-2 text-[13px] leading-[18px] animate-home-hit motion-reduce:animate-none"
					style={{ animationDelay: `${index * 0.1}s` }}
				>
					{hit.before}
					<mark className="rounded-[3px] bg-brand-subtle text-brand-text">{hit.mark}</mark>
					{hit.after}
				</div>
			))}
		</div>
	)
}
