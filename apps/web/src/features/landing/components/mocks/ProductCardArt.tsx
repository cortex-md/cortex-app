import { Lock } from "lucide-react"
import {
	type ProductCardArt as ProductCardArtKind,
	productsGroup,
} from "../../../../content/landing"

const raisedClass = "bg-bg-elevated shadow-lift"

export function ProductCardArt({ art }: { art: ProductCardArtKind }) {
	if (art === "desktop") {
		return (
			<div className="absolute inset-x-[22px] top-[18px] bottom-0 grid grid-cols-[70px_1fr] overflow-hidden rounded-t-xl bg-sidebar shadow-lift">
				<div className="flex flex-col gap-[5px] px-2 py-3">
					{[0, 1, 2, 3].map((item) => (
						<span key={item} className="h-2 rounded bg-sep" />
					))}
				</div>
				<div className="mt-2 mr-2 rounded-t-lg bg-bg-primary p-3.5">
					<b className="block font-app text-[14px] leading-[1.2] font-bold">
						{productsGroup.desktopTitle}
					</b>
					<i className="mt-[7px] block h-[7px] rounded bg-cell" />
					<i className="mt-[7px] block h-[7px] w-[70%] rounded bg-cell" />
					<i className="mt-[7px] block h-[7px] rounded bg-cell" />
				</div>
			</div>
		)
	}

	if (art === "mobile") {
		return (
			<div
				className={`absolute top-[18px] left-1/2 -ml-[54px] flex h-[210px] w-[108px] flex-col gap-1.5 rounded-[22px] px-2.5 py-[18px] animate-home-float motion-reduce:animate-none ${raisedClass}`}
			>
				<span className="h-3.5 w-[60%] rounded-[5px] bg-cell" />
				<span className="h-3.5 rounded-[5px] bg-brand-subtle" />
				<span className="h-3.5 rounded-[5px] bg-cell" />
				<span className="h-3.5 rounded-[5px] bg-cell" />
				<span className="h-3.5 w-[60%] rounded-[5px] bg-cell" />
			</div>
		)
	}

	if (art === "sync") {
		return (
			<>
				<div className="absolute inset-0 flex items-center justify-around">
					<span className={`h-[54px] w-[74px] rounded-[10px] ${raisedClass}`} />
					<span className={`h-[66px] w-9 rounded-[10px] ${raisedClass}`} />
				</div>
				<i className="absolute top-1/2 left-[28%] -mt-[5px] size-2.5 rounded-full bg-brand shadow-[0_0_0_5px_var(--accent-subtle)] animate-home-packet motion-reduce:animate-none" />
			</>
		)
	}

	if (art === "publish") {
		return (
			<div
				className={`absolute inset-x-[22px] top-[18px] bottom-0 rounded-t-xl px-3.5 py-2.5 ${raisedClass}`}
			>
				<div className="flex items-center gap-1.5 rounded-lg bg-cell px-2.5 py-[5px] font-app text-[11.5px] leading-none text-text-secondary">
					<Lock className="size-3 shrink-0" aria-hidden="true" />
					<span>
						{productsGroup.publishUrl}
						<b className="font-medium text-text-primary">{productsGroup.publishSlug}</b>
					</span>
				</div>
				<div className="mt-3.5 mb-1.5 font-app text-[16px] leading-[1.2] font-bold">
					{productsGroup.publishTitle}
				</div>
				<span className="mt-[7px] block h-2 rounded bg-cell" />
				<span className="mt-[7px] block h-2 w-[70%] rounded bg-cell" />
			</div>
		)
	}

	if (art === "marketplace") {
		return (
			<div className="absolute inset-[18px] grid grid-cols-3 gap-2">
				{[0, 1, 2, 3, 4, 5].map((tile) => (
					<span
						key={tile}
						className="rounded-[10px] bg-bg-elevated shadow-ring animate-home-blink motion-reduce:animate-none"
						style={{ animationDelay: tile % 2 === 1 ? `${(tile - 1) * 0.25 + 0.5}s` : undefined }}
					/>
				))}
			</div>
		)
	}

	return (
		<div className="absolute inset-4 rounded-xl bg-home-term p-3.5 font-mono text-[12.5px] leading-5 text-home-term-text">
			<span className="text-home-term-muted">$</span>{" "}
			<span className="inline-block w-[22ch] overflow-hidden align-bottom whitespace-nowrap animate-home-term-type motion-reduce:animate-none">
				{productsGroup.cliCommand}
			</span>
			<br />
			<span className="text-home-term-ok animate-home-term-later motion-reduce:animate-none">
				{productsGroup.cliResult}
			</span>
		</div>
	)
}
