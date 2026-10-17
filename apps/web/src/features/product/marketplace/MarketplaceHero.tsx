import { cn } from "@cortex/ui/lib/utils"
import { Check, Search } from "lucide-react"
import { marketplacePage } from "../../../content/product"
import { Painting } from "../../site/Painting"
import { CtaRow, MockFigure, ProductHero } from "../shared/layout"
import { type MockPalette, mockPalettes, swatchClasses } from "./mockPalettes"

const { hero, window: win } = marketplacePage

function Swatch({ id }: { id: keyof typeof swatchClasses }) {
	return (
		<i
			className={cn(
				"size-[30px] flex-none rounded-lg shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]",
				swatchClasses[id],
			)}
		/>
	)
}

function InUse() {
	return (
		<em className="rounded-full bg-[color-mix(in_srgb,var(--m-acc)_16%,transparent)] px-[7px] py-[3px] text-[11px] leading-none font-medium text-[var(--m-acc)] not-italic">
			{win.inUse}
		</em>
	)
}

function ThemeRow({
	id,
	name,
	detail,
	active,
	inUse,
}: {
	id: keyof typeof swatchClasses
	name: string
	detail: string
	active?: boolean
	inUse?: boolean
}) {
	return (
		<div
			className={cn("flex items-center gap-2.5 rounded-[9px] p-2", active && "bg-[var(--m-hover)]")}
		>
			<Swatch id={id} />
			<span className="flex flex-1 flex-col gap-[3px]">
				<b className="font-medium">{name}</b>
				<small className="text-[11.5px] text-[var(--m-mute)]">{detail}</small>
			</span>
			{inUse ? <InUse /> : null}
		</div>
	)
}

function CoverHalf({ tone }: { tone: "dark" | "light" }) {
	return (
		<div
			className={cn(
				"flex flex-col gap-[9px] px-5 py-[18px] text-[15px] leading-none font-semibold",
				tone === "dark" ? "bg-[#1d2021] text-[#ebdbb2]" : "bg-[#fbf1c7] text-[#3c3836]",
			)}
		>
			<b>{win.coverTitle}</b>
			<i className="h-1.5 w-[82%] rounded-[3px] bg-current opacity-[0.28]" />
			<i className="h-1.5 w-[56%] rounded-[3px] bg-current opacity-[0.28]" />
			<span
				className={cn(
					"text-[12.5px] leading-none font-medium",
					tone === "dark" ? "text-[#fabd2f]" : "text-[#af3a03]",
				)}
			>
				{win.coverLink}
			</span>
		</div>
	)
}

function MarketplaceWindow({ palette }: { palette: MockPalette }) {
	const isGruv = palette === "gruv"

	return (
		<div
			className={cn(
				"absolute inset-0 flex flex-col overflow-hidden rounded-t-[14px] bg-[var(--m-side)] text-left text-[13px] leading-[1.3] text-[var(--m-fg)] shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_30px_70px_-20px_rgba(30,20,30,0.45)]",
				isGruv &&
					"[clip-path:circle(0%_at_37%_70%)] animate-product-wipe motion-reduce:animate-none",
			)}
			style={mockPalettes[palette]}
		>
			<div className="flex h-[38px] flex-none items-center gap-[7px] px-3.5">
				<i className="size-[11px] rounded-full bg-[var(--m-line)]" />
				<i className="size-[11px] rounded-full bg-[var(--m-line)]" />
				<i className="size-[11px] rounded-full bg-[var(--m-line)]" />
				<span className="ml-3 font-medium text-[var(--m-mute)]">{win.title}</span>
			</div>
			<div className="grid min-h-0 flex-1 grid-cols-[290px_1fr]">
				<aside className="px-3 py-1">
					<div className="flex h-8 items-center gap-2 rounded-lg bg-[var(--m-bg)] px-2.5 text-[var(--m-mute)] shadow-[0_0_0_1px_var(--m-line)]">
						<Search className="size-3.5" />
						<span>{win.search}</span>
					</div>
					<div className="mt-3 mb-3.5 grid grid-cols-3 gap-0.5 rounded-[9px] bg-[var(--m-hover)] p-[3px]">
						{win.tabs.map((tab) => (
							<span
								key={tab}
								className={cn(
									"rounded-[7px] py-1.5 text-center font-medium text-[var(--m-2)]",
									tab === win.activeTab &&
										"bg-[var(--m-bg)] text-[var(--m-fg)] shadow-[0_1px_2px_rgba(0,0,0,0.12)]",
								)}
							>
								{tab}
							</span>
						))}
					</div>
					<div className="mx-2 mt-2.5 mb-1.5 flex justify-between text-[11.5px] font-medium text-[var(--m-mute)]">
						{win.installedLabel}
						<em className="not-italic">{win.themes.length}</em>
					</div>
					{win.themes.map((theme) => (
						<ThemeRow
							key={theme.id}
							id={theme.id}
							name={theme.name}
							detail={win.builtIn}
							inUse={!isGruv && theme.id === "paper"}
						/>
					))}
					<div className="mx-2 mt-2.5 mb-1.5 flex justify-between text-[11.5px] font-medium text-[var(--m-mute)]">
						{win.communityLabel}
						<em className="not-italic">1</em>
					</div>
					<ThemeRow
						id="gruv"
						name={win.community.name}
						detail={win.community.author}
						active
						inUse={isGruv}
					/>
				</aside>
				<section className="mr-2 overflow-hidden rounded-t-[10px] bg-[var(--m-bg)] px-[34px] py-[26px] shadow-[0_0_0_1px_var(--m-line)]">
					<div className="grid h-[132px] grid-cols-2 overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--m-line)]">
						<CoverHalf tone="dark" />
						<CoverHalf tone="light" />
					</div>
					<h2 className="mt-[22px] mb-1 text-[24px] leading-[1.15] font-bold tracking-[-0.02em]">
						{win.community.name}
					</h2>
					<p className="mb-2.5 text-[var(--m-mute)]">{win.community.author}</p>
					<p className="text-[14px] leading-[1.5] text-[var(--m-2)]">{win.description}</p>
					<div className="mt-[18px] mb-5 flex gap-2">
						<span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--m-acc)] px-3.5 font-medium text-[var(--m-acc-fg)]">
							{isGruv ? (
								<>
									<Check className="size-3.5" />
									{win.inUse}
								</>
							) : (
								win.useTheme
							)}
						</span>
						<span className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 font-medium text-[var(--m-2)] shadow-[inset_0_0_0_1px_var(--m-line)]">
							{win.uninstall}
						</span>
					</div>
					<div className="grid grid-cols-2 gap-x-7 border-t border-[var(--m-line)]">
						{win.info.map((row) => (
							<div
								key={row.label}
								className="flex justify-between border-b border-[var(--m-line)] py-2.5"
							>
								<span className="text-[var(--m-mute)]">{row.label}</span>
								<b className="font-medium">{row.value}</b>
							</div>
						))}
					</div>
				</section>
			</div>
		</div>
	)
}

export function MarketplaceHero() {
	return (
		<ProductHero title={hero.title} quiet={hero.quiet} lead={hero.lead}>
			<CtaRow
				primary={marketplacePage.primaryCta}
				secondary={marketplacePage.secondaryCta}
				page="marketplace"
			/>
			<MockFigure
				label={win.alt}
				className="relative isolate mt-16 overflow-hidden rounded-[28px] px-[72px] pt-16 max-[1000px]:px-8 max-[1000px]:pt-10 max-sm:mt-10 max-sm:rounded-[22px] max-sm:pt-7 max-sm:pr-0 max-sm:pl-5"
			>
				<Painting name="wheat" position="center 62%" priority />
				<div className="relative z-[1] mx-auto h-[480px] max-w-[1000px] max-[1000px]:m-0 max-[1000px]:w-[1000px] max-[1000px]:max-w-none max-[1000px]:[zoom:0.62] max-sm:[zoom:0.5]">
					<MarketplaceWindow palette="paper" />
					<MarketplaceWindow palette="gruv" />
					<svg
						className="absolute top-[92%] left-[62%] z-[4] size-[22px] fill-[#1c1917] stroke-white stroke-[1.4] drop-shadow-[0_2px_3px_rgba(0,0,0,0.3)] animate-product-cursor motion-reduce:hidden"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path d="M5 3l14 8-6.2 1.6L10 19z" />
					</svg>
				</div>
			</MockFigure>
		</ProductHero>
	)
}
