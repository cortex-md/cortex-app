import { CheckCircle2, Circle, CircleDashed } from "lucide-react"
import { roadmapStatusGroups } from "../../content/landing"
import { LandingFooter } from "../landing/sections/LandingFooter"
import { SiteHeader } from "../site/SiteHeader"

type RoadmapStatusGroup = (typeof roadmapStatusGroups)[number]

const roadmapStatusMeta = {
	shipped: {
		badge: "Available now",
		icon: CheckCircle2,
		iconClassName: "text-brand-text",
	},
	"in-progress": {
		badge: "Being built",
		icon: CircleDashed,
		iconClassName: "text-accent-sky-text",
	},
	planned: {
		badge: "Planned",
		icon: Circle,
		iconClassName: "text-text-muted",
	},
} as const

function RoadmapStatusSection({ group }: { group: RoadmapStatusGroup }) {
	const meta = roadmapStatusMeta[group.id]
	const Icon = meta.icon

	return (
		<section
			className="grid grid-cols-[190px_minmax(0,1fr)] gap-12 border-border-subtle border-t py-12 max-md:grid-cols-1 max-md:gap-6 max-md:py-10"
			aria-labelledby={`${group.id}-roadmap-title`}
		>
			<div className="self-start md:sticky md:top-28">
				<div className="mb-4 flex items-center gap-3">
					<span
						className="grid size-8 shrink-0 place-items-center rounded-lg bg-bg-secondary text-text-muted shadow-[0_0_0_1px_var(--border-subtle)]"
						aria-hidden="true"
					>
						<Icon className={`size-4 ${meta.iconClassName}`} />
					</span>
				</div>
				<h2
					className="m-0 text-balance text-[clamp(24px,3vw,34px)] leading-[1.08] font-semibold tracking-[-0.012em] text-text-primary"
					id={`${group.id}-roadmap-title`}
				>
					{group.title}
				</h2>
				<p className="mt-4 max-w-[220px] text-pretty text-[14px] leading-6 text-text-muted max-md:max-w-[620px]">
					{group.description}
				</p>
			</div>

			<ul className="m-0 flex flex-col gap-2 p-0">
				{group.items.map((item) => (
					<li
						className="gap-6 rounded-lg bg-bg-elevated p-5 shadow-[0_0_0_1px_var(--border-subtle),0_2px_8px_rgba(24,18,8,0.05)] max-sm:grid-cols-1 max-sm:gap-2 max-sm:p-4"
						key={item.title}
					>
						<span className="min-w-0">
							<span className="block text-pretty text-[16px] leading-6 font-semibold text-text-primary">
								{item.title}
							</span>
							<span className="mt-1 block max-w-[680px] text-pretty text-[14px] leading-6 text-text-secondary">
								{item.description}
							</span>
						</span>
					</li>
				))}
			</ul>
		</section>
	)
}

export function RoadmapPage() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<SiteHeader homeHrefPrefix="/" surface="roadmap" />
			<main id="main-content" tabIndex={-1}>
				<section className="mx-auto w-[min(1180px,calc(100%_-_64px))] pt-[140px] pb-24 max-lg:w-[min(calc(100%_-_48px),940px)] max-md:w-[min(calc(100%_-_36px),720px)] max-md:pt-[124px] max-md:pb-[80px] max-sm:w-[min(calc(100%_-_28px),520px)] max-sm:pt-[108px] max-sm:pb-[68px]">
					<div className="grid max-w-[780px] gap-4">
						<p className="m-0 text-[15px] leading-6 font-medium text-text-muted">Roadmap</p>
						<h1 className="m-0 max-w-[760px] text-balance text-[clamp(42px,5.4vw,72px)] leading-[1.02] font-semibold tracking-[-0.025em] text-text-primary">
							What has shipped, what is in motion, and what is next.
						</h1>
						<p className="m-0 max-w-[620px] text-pretty text-[17px] leading-7 text-text-secondary">
							Cortex keeps product status explicit so you can tell the shipped workspace apart from
							the work ahead.
						</p>
						<p className="m-0 max-w-[620px] text-pretty text-[17px] leading-7 text-text-secondary">
							You can always{" "}
							<a
								className="text-brand-text hover:underline"
								href="https://github.com/cortex-md/cortex-app/issues"
							>
								reach us
							</a>{" "}
							with your desires or ideas for the future of the app.
						</p>
					</div>

					<div className="mt-14">
						{roadmapStatusGroups.map((group) => (
							<RoadmapStatusSection group={group} key={group.id} />
						))}
					</div>
				</section>
			</main>
			<LandingFooter homeHrefPrefix="/" />
		</div>
	)
}
