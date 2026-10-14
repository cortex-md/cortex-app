export function CortexMark({ className, size = 30 }: { className?: string; size?: number }) {
	return (
		<img
			className={["block rounded-lg", className].filter(Boolean).join(" ")}
			src="/icon-192.png"
			width={size}
			height={size}
			alt=""
		/>
	)
}
