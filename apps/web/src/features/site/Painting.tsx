import { cn } from "@cortex/ui/lib/utils"
import type React from "react"

export type PaintingName = "dawn" | "coast" | "meadow" | "dusk" | "mist" | "wheat"

const paintingWidths = [960, 1800] as const

export function getPaintingSrc(name: PaintingName, width: (typeof paintingWidths)[number] = 1800) {
	return `/media/paintings/${name}-${width}.webp`
}

export function getPaintingSrcSet(name: PaintingName) {
	return paintingWidths.map((width) => `${getPaintingSrc(name, width)} ${width}w`).join(", ")
}

interface PaintingProps {
	name: PaintingName
	position?: string
	blur?: "soft" | "strong"
	duration?: "slow" | "fast"
	priority?: boolean
	sizes?: string
	className?: string
}

export function Painting({
	name,
	position = "center 50%",
	blur = "strong",
	duration = "slow",
	priority = false,
	sizes = "(max-width: 1000px) 100vw, 1180px",
	className,
}: PaintingProps) {
	return (
		<img
			className={cn(
				"pointer-events-none absolute -inset-[8%] z-0 h-[116%] w-[116%] max-w-none object-cover select-none saturate-[1.06] animate-ken-burns motion-reduce:animate-none",
				blur === "strong" ? "blur-[5px]" : "blur-[3px]",
				duration === "fast" && "[animation-duration:30s]",
				className,
			)}
			style={{ objectPosition: position } as React.CSSProperties}
			src={getPaintingSrc(name, 960)}
			srcSet={getPaintingSrcSet(name)}
			sizes={sizes}
			width={1800}
			height={1100}
			alt=""
			aria-hidden="true"
			loading={priority ? "eager" : "lazy"}
			fetchPriority={priority ? "high" : "auto"}
			decoding="async"
			draggable={false}
		/>
	)
}

export function PaintedFrame({
	painting,
	position,
	priority,
	className,
	children,
	...props
}: {
	painting: PaintingName
	position?: string
	priority?: boolean
	className?: string
	children: React.ReactNode
} & Omit<React.ComponentProps<"div">, "children">) {
	return (
		<div className={cn("relative isolate overflow-hidden rounded-[28px]", className)} {...props}>
			<Painting name={painting} position={position} priority={priority} />
			<div className="relative z-[1]">{children}</div>
		</div>
	)
}
