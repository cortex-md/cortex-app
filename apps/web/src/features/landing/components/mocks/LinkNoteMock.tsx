import { cn } from "@cortex/ui/lib/utils"
import { linkScene } from "../../../../content/landing"

export function LinkNoteMock({
	variant,
	className,
}: {
	variant: "hero" | "tile"
	className?: string
}) {
	const loop = variant === "tile"

	return (
		<div
			className={cn(
				"grid gap-[22px]",
				loop
					? "absolute inset-5 grid-cols-[minmax(0,1fr)_190px] gap-3.5"
					: "h-full grid-cols-[minmax(0,1fr)_230px]",
				className,
			)}
		>
			<div className="font-app">
				<div className="mb-3.5 text-[12px] leading-none text-text-muted">{linkScene.path}</div>
				<div
					className={cn(
						"mb-1.5 font-bold tracking-[-0.015em]",
						loop ? "text-[18px] leading-[1.2]" : "text-[26px] leading-[1.2]",
					)}
				>
					{linkScene.title}
				</div>
				{loop ? null : <p className="mb-2.5 text-[15.5px] leading-[26px]">{linkScene.intro}</p>}
				<p
					className={cn(
						"mb-2.5",
						loop ? "text-[13.5px] leading-[22px]" : "text-[15.5px] leading-[26px]",
					)}
				>
					{linkScene.linePrefix}{" "}
					<span className="relative inline-block">
						<span
							className={cn(
								"inline-block max-w-0 overflow-hidden border-r-2 border-brand align-bottom whitespace-nowrap text-text-muted motion-reduce:animate-none",
								loop ? "animate-home-lk-loop-type" : "animate-home-lk-type",
							)}
						>
							{linkScene.typing}
						</span>
						<span
							className={cn(
								"pointer-events-none absolute top-[calc(100%+6px)] left-0 z-[3] flex w-[230px] flex-col gap-0.5 rounded-xl bg-bg-elevated p-1.5 text-[13px] leading-[1.2] opacity-0 shadow-lift motion-reduce:animate-none",
								loop ? "animate-home-lk-loop-pop" : "animate-home-lk-pop",
							)}
							aria-hidden="true"
						>
							{linkScene.suggestions.map((suggestion) => (
								<span
									key={suggestion.label}
									className={cn(
										"flex justify-between rounded-lg px-2.5 py-2",
										"active" in suggestion && suggestion.active
											? "bg-brand-subtle text-brand-text"
											: "folder" in suggestion
												? "text-text-primary"
												: "text-text-secondary",
									)}
								>
									{suggestion.label}
									{"folder" in suggestion ? (
										<small className="text-[11.5px] text-text-muted">{suggestion.folder}</small>
									) : null}
								</span>
							))}
						</span>
					</span>
					<span
						className={cn(
							"inline-block max-w-[12ch] overflow-hidden align-bottom whitespace-nowrap text-brand-text underline decoration-[color-mix(in_srgb,var(--accent)_40%,transparent)] underline-offset-[3px] motion-reduce:animate-none",
							loop ? "animate-home-lk-loop-link" : "animate-home-lk-show",
						)}
					>
						{linkScene.link}
					</span>
					.
				</p>
			</div>
			<aside className="flex flex-col gap-2 self-start rounded-xl bg-sidebar p-3 font-app text-[12px] leading-[1.4] text-text-secondary shadow-ring">
				<div className="mb-0.5 flex justify-between text-[13px] leading-none font-semibold text-text-primary">
					{linkScene.backlinksTitle}
					<small className="relative pr-[1.9ch] font-normal text-text-muted">
						{linkScene.backlinksLabel}{" "}
						<b
							className={cn(
								"absolute top-0 right-0 ml-1 text-brand-text opacity-0 motion-reduce:animate-none",
								loop ? "animate-home-lk-loop-n2" : "animate-home-lk-n2",
							)}
							aria-hidden="true"
						>
							{linkScene.backlinks.length}
						</b>
						<b
							className={cn(
								"absolute top-0 right-0 ml-1 text-brand-text motion-reduce:animate-none",
								loop ? "animate-home-lk-loop-n3" : "animate-home-lk-n3",
							)}
						>
							{linkScene.backlinks.length + 1}
						</b>
					</small>
				</div>
				{linkScene.backlinks.map((backlink, index) =>
					loop && index === 1 ? null : (
						<div key={backlink.title} className="rounded-lg bg-bg-elevated px-2.5 py-2">
							<b className="mb-0.5 block font-medium text-text-primary">{backlink.title}</b>
							{backlink.text}
						</div>
					),
				)}
				<div
					className={cn(
						"rounded-lg bg-bg-elevated px-2.5 py-2 shadow-[0_0_0_1.5px_var(--accent)] motion-reduce:animate-none",
						loop ? "animate-home-lk-loop-new" : "animate-home-lk-new",
					)}
				>
					<b className="mb-0.5 block font-medium text-text-primary">
						{linkScene.newBacklink.title}
					</b>
					{linkScene.newBacklink.text}
				</div>
			</aside>
		</div>
	)
}
