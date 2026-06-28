interface SectionHeadingProps {
	title: string
	description: string
	tone?: "paper" | "ink"
	className?: string
}

export function SectionHeading({
	title,
	description,
	tone = "paper",
	className = "",
}: SectionHeadingProps) {
	const mutedText = tone === "ink" ? "text-white/[0.58]" : "text-muted-foreground"

	return (
		<div className={`mb-10 grid max-w-[820px] gap-4 md:mb-12 ${className}`}>
			<h2 className="m-0 max-w-[760px] text-balance text-[clamp(30px,3.2vw,44px)] leading-[1.1] font-semibold tracking-[-0.015em] max-sm:text-[25px]">
				{title}
			</h2>
			<p className={`m-0 max-w-[680px] text-[15px] leading-[1.65] max-sm:text-sm ${mutedText}`}>
				{description}
			</p>
		</div>
	)
}
