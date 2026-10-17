import { cn } from "@cortex/ui/lib/utils"
import { ArrowRight } from "lucide-react"
import { recentlyShipped } from "../../../content/landing"
import { revealClass } from "../../site/motion"
import { HomeSection, homeH2Class } from "../components/HomeLayout"

export function RecentlyShippedSection() {
	return (
		<HomeSection aria-labelledby="recently-shipped-title">
			<h2 id="recently-shipped-title" className={cn(homeH2Class, revealClass)}>
				{recentlyShipped.title}
			</h2>
			<div className="mt-10 grid">
				{recentlyShipped.items.map((item) => (
					<a
						key={item.title}
						href={recentlyShipped.href}
						className="grid grid-cols-[140px_1fr_auto] items-baseline gap-6 border-sep border-b px-1 py-[18px] text-inherit no-underline outline-none transition-[padding] duration-[250ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:pl-3 focus-visible:shadow-focus motion-reduce:transition-none max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-4 max-sm:gap-y-1.5"
					>
						<span className="text-[14px] leading-none text-text-muted max-sm:col-span-full">
							{item.area}
						</span>
						<span>
							<b className="text-[16px] leading-[1.4] font-medium">{item.title}</b>
							<br />
							<span className="text-[14.5px] leading-[1.5] text-text-secondary">
								{item.description}
							</span>
						</span>
						<ArrowRight className="size-4 self-center text-text-muted" aria-hidden="true" />
					</a>
				))}
			</div>
		</HomeSection>
	)
}
