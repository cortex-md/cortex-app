const markSrcSet = [64, 128, 192]
	.map((width) => `/brand/cortex-mark-${width}.webp ${width}w`)
	.join(", ")

export function CortexMark({ className, size = 30 }: { className?: string; size?: number }) {
	return (
		<img
			className={["block", className].filter(Boolean).join(" ")}
			src="/brand/cortex-mark-128.webp"
			srcSet={markSrcSet}
			sizes={`${size}px`}
			width={size}
			height={size}
			decoding="async"
			alt=""
		/>
	)
}
