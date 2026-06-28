interface ProductMediaProps {
	label: string
	description: string
	alt: string
	src: string
	webpSrc?: string
	width?: number
	height?: number
	aspect?: "hero" | "wide" | "portrait" | "sync"
	fit?: "cover" | "contain"
	frame?: "surface" | "bare"
	imageScale?: "normal" | "large" | "sync"
	priority?: boolean
	tone?: "paper" | "ink"
	className?: string
}

const aspectClassNames = {
	hero: "aspect-[16/10]",
	wide: "aspect-[16/10]",
	portrait: "aspect-[4/5] max-md:aspect-[16/10]",
	sync: "aspect-[1307/557]",
} as const

const fitClassNames = {
	cover: "object-cover",
	contain: "object-contain",
} as const

const imageScaleClassNames = {
	normal: "size-full",
	large:
		"size-full origin-center scale-[1.34] max-lg:scale-[1.28] max-md:scale-[1.42] max-sm:scale-[1.55]",
	sync: "size-full origin-center scale-[1.12] max-lg:scale-[1.08] max-md:scale-[1.16] max-sm:scale-[1.22]",
} as const

export function ProductMedia({
	label,
	description,
	alt,
	src,
	webpSrc,
	width = 1600,
	height = 1000,
	aspect = "wide",
	fit = "cover",
	frame = "surface",
	imageScale = "normal",
	priority = false,
	tone = "paper",
	className = "",
}: ProductMediaProps) {
	const isInk = tone === "ink"
	const isBare = frame === "bare"
	const figureTone = isBare
		? "bg-transparent shadow-none"
		: isInk
			? "rounded-xl bg-[#17140f] shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_2px_8px_rgba(0,0,0,0.2)]"
			: "rounded-xl bg-bg-secondary shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_2px_8px_rgba(24,18,8,0.05)]"
	const imageOutline = isInk ? "outline-white/10" : "outline-black/10"
	const imageFrame = isBare ? "" : `outline outline-1 -outline-offset-1 ${imageOutline}`
	const overflowClass = isBare ? "overflow-visible" : "overflow-hidden"

	return (
		<figure
			className={`m-0 ${overflowClass} ${figureTone} ${className}`}
			data-image-scale={imageScale}
			data-media-frame={frame}
		>
			<figcaption className="sr-only">
				{label}. {description}
			</figcaption>
			<div className={`relative ${aspectClassNames[aspect]}`}>
				<picture>
					{webpSrc ? <source srcSet={webpSrc} type="image/webp" /> : null}
					<img
						className={`${imageScaleClassNames[imageScale]} ${imageFrame} ${fitClassNames[fit]}`}
						src={src}
						alt={alt}
						width={width}
						height={height}
						loading={priority ? "eager" : "lazy"}
						fetchPriority={priority ? "high" : "auto"}
						decoding="async"
					/>
				</picture>
			</div>
		</figure>
	)
}
