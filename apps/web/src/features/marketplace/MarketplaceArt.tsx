import { cn } from "@cortex/ui/lib/utils"
import { Gem, Icon, Puzzle } from "lucide-react"
import type React from "react"
import type { ThemePalette } from "../../lib/registry/types"
import type { MarketplaceItem } from "../../server/marketplace"

type ArtSize = "card" | "shot"

function paletteStyle(palette: ThemePalette) {
	return {
		"--b": palette.bg,
		"--s": palette.side,
		"--t": palette.text,
		"--m": palette.muted,
		"--a": palette.accent,
		"--f": palette.fill,
		"--l": palette.line,
		"--g": palette.tag,
		"--gt": palette.tagText,
	} as React.CSSProperties
}

const windowDots =
	"h-1.5 w-[26px] bg-[radial-gradient(circle_3px_at_3px_3px,#ff5f57_98%,transparent)] bg-[length:10px_6px] bg-repeat-x"

export function ThemeWindow({ palette, size = "card" }: { palette: ThemePalette; size?: ArtSize }) {
	const isShot = size === "shot"
	return (
		<div
			className={cn(
				"grid h-full min-w-0 flex-1 grid-cols-[30%_1fr] overflow-hidden bg-(--s) shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_10px_20px_-12px_rgba(0,0,0,0.35)]",
				isShot ? "rounded-[14px]" : "rounded-[10px]",
			)}
			style={paletteStyle(palette)}
			aria-hidden="true"
		>
			<div
				className={cn(
					"flex flex-col",
					isShot ? "gap-2.5 px-3 py-4 max-sm:gap-1.5 max-sm:px-2" : "gap-1.5 px-2 py-2.5",
				)}
			>
				<i className={windowDots} />
				<i className={cn("rounded-[3px] bg-(--m) opacity-35", isShot ? "h-[9px]" : "h-1.5")} />
				<i className={cn("rounded-[3px] bg-(--l)", isShot ? "h-[15px]" : "h-2.5")} />
				<i className={cn("rounded-[3px] bg-(--m) opacity-35", isShot ? "h-[9px]" : "h-1.5")} />
				<i className={cn("rounded-[3px] bg-(--m) opacity-35", isShot ? "h-[9px]" : "h-1.5")} />
			</div>
			<div
				className={cn(
					"mt-1.5 mr-1.5 flex flex-col rounded-t-lg bg-(--b) text-(--t)",
					isShot ? "gap-3 px-6 py-[22px] max-sm:gap-2 max-sm:px-4 max-sm:py-3.5" : "gap-[7px] p-3",
				)}
			>
				<b
					className={cn(
						"leading-none font-bold not-italic",
						isShot ? "text-[20px] max-sm:text-[16px]" : "text-[13px]",
					)}
				>
					Roadmap
				</b>
				<i
					className={cn(
						"w-[90%] rounded-[3px] bg-(--t) opacity-[0.22]",
						isShot ? "h-2" : "h-[5px]",
					)}
				/>
				<i
					className={cn(
						"w-[70%] rounded-[3px] bg-(--t) opacity-[0.22]",
						isShot ? "h-2" : "h-[5px]",
					)}
				/>
				<span
					className={cn(
						"flex items-center leading-none font-medium",
						isShot ? "gap-2.5 text-[12.5px]" : "gap-1.5 text-[9.5px]",
					)}
				>
					<em className="text-(--a) not-italic">[[Design review]]</em>
					<u className="rounded-[5px] bg-(--g) px-[5px] py-0.5 text-(--gt) no-underline">
						#project
					</u>
				</span>
				<i
					className={cn(
						"w-[80%] rounded-[3px] bg-(--t) opacity-[0.22]",
						isShot ? "h-2" : "h-[5px]",
					)}
				/>
				<span
					className={cn("mt-0.5 rounded-full bg-(--f)", isShot ? "h-6 w-[84px]" : "h-3.5 w-11")}
				/>
			</div>
		</div>
	)
}

export function ItemGlyph({ item, className }: { item: MarketplaceItem; className?: string }) {
	if (item.kind === "themes") return <Gem className={className} aria-hidden="true" />
	if (item.iconNode) {
		return <Icon iconNode={item.iconNode} className={className} aria-hidden="true" />
	}
	return <Puzzle className={className} aria-hidden="true" />
}

export function itemTone(item: MarketplaceItem) {
	return item.kind === "plugins" ? "var(--accent-subtle)" : "var(--site-cell)"
}

export function CardArt({ item }: { item: MarketplaceItem }) {
	const coverUrl = item.coverImageUrl ?? item.screenshots[0]
	if (coverUrl) {
		return (
			<div className="relative h-40 overflow-hidden rounded-2xl bg-cell">
				<img
					className="size-full object-cover object-top"
					src={coverUrl}
					width={400}
					height={160}
					alt={`${item.name} cover`}
					loading="lazy"
					decoding="async"
					referrerPolicy="no-referrer"
				/>
			</div>
		)
	}

	if (item.kind === "themes" && item.palettes.length > 0) {
		return (
			<div className="flex h-40 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-cell p-3.5">
				{item.palettes.map((palette) => (
					<ThemeWindow key={palette.label} palette={palette} />
				))}
			</div>
		)
	}

	return (
		<div
			className="flex h-40 items-center justify-center overflow-hidden rounded-2xl bg-[radial-gradient(70%_90%_at_50%_0%,var(--tone),var(--site-cell))]"
			style={{ "--tone": itemTone(item) } as React.CSSProperties}
		>
			<span className="inline-flex size-14 items-center justify-center rounded-[17px] bg-bg-elevated text-text-primary shadow-[var(--site-ring),0_8px_18px_-10px_rgba(28,25,23,0.3)]">
				<ItemGlyph item={item} className="size-[26px]" />
			</span>
		</div>
	)
}
