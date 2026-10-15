import { cn } from "@cortex/ui/lib/utils"
import { StatusBadge } from "@cortex/ui/status-badge"
import { ArrowRight } from "lucide-react"
import { mobilePage } from "../../../content/product"
import { Painting } from "../../site/Painting"
import { MockFigure, ProductHero } from "../shared/layout"

const { hero, mock } = mobilePage

function BigPhone() {
	return (
		<div className="absolute top-[34px] left-1/2 -ml-[115px] flex h-[470px] w-[230px] flex-col gap-2 rounded-[42px] bg-bg-elevated px-4 pt-[46px] pb-4 text-left text-[13px] leading-[18px] shadow-[var(--site-lift),0_0_0_8px_color-mix(in_srgb,var(--text-primary)_8%,transparent)] animate-product-float motion-reduce:animate-none">
			<h5 className="mb-1 text-[22px] leading-[1.1] font-bold">{mock.today}</h5>
			{mock.tasks.map((task) => (
				<div
					key={task.label}
					className="flex items-center gap-2 rounded-xl bg-cell px-2.5 py-[9px]"
				>
					<i
						className={cn(
							"size-4 rounded-full",
							task.done
								? "bg-brand animate-product-pop motion-reduce:animate-none"
								: "shadow-[inset_0_0_0_2px_var(--text-muted)]",
						)}
					/>
					{task.label}
				</div>
			))}
			<h5 className="mt-3 mb-1 text-[16px] leading-[1.1] font-bold">{mock.projectsTitle}</h5>
			{mock.projects.map((project) => (
				<div key={project} className="flex items-center gap-2 rounded-xl bg-cell px-2.5 py-[9px]">
					{project}
				</div>
			))}
		</div>
	)
}

export function MobileHero() {
	return (
		<ProductHero title={hero.title} quiet={hero.quiet} lead={hero.lead}>
			<div className="mt-6 flex justify-center">
				<StatusBadge color="purple" size="lg" dot={false}>
					{mobilePage.status}
				</StatusBadge>
			</div>
			<p className="mt-[30px] text-[13.5px] leading-none">
				<a
					className="inline-flex items-center gap-1.5 rounded-md text-text-secondary underline-offset-[3px] outline-none hover:text-text-primary hover:underline focus-visible:shadow-focus"
					href={mobilePage.followCta.href}
				>
					{mobilePage.followCta.label}
					<ArrowRight className="size-3.5" aria-hidden="true" />
				</a>
			</p>
			<MockFigure
				label={mock.alt}
				className="relative isolate mt-16 overflow-hidden rounded-[28px] p-16 max-sm:mt-10 max-sm:rounded-[22px] max-sm:p-6"
			>
				<Painting name="meadow" position="center 60%" priority />
				<div className="relative z-[1] h-[420px] overflow-hidden rounded-3xl">
					<BigPhone />
				</div>
			</MockFigure>
		</ProductHero>
	)
}
