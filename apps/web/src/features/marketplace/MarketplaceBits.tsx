import { Button } from "@cortex/ui/button"
import { useRouter } from "@tanstack/react-router"
import { marketplaceCopy, publishingGuideUrl } from "../../content/marketplace"

export function SubmitBanner() {
	const copy = marketplaceCopy.submit
	return (
		<section className="mt-[72px] flex flex-wrap items-center gap-2.5 rounded-[22px] px-6 py-[22px] shadow-[inset_0_0_0_1px_var(--site-sep)]">
			<div className="flex-[1_1_360px]">
				<h2 className="text-[16px] leading-[1.3] font-semibold">{copy.title}</h2>
				<p className="mt-1 text-[14px] leading-[1.45] text-text-secondary">
					{copy.bodyBefore}{" "}
					<code className="rounded-md bg-cell px-1.5 py-0.5 font-mono text-[13px] text-text-primary">
						{copy.command}
					</code>{" "}
					{copy.bodyAfter}
				</p>
			</div>
			<Button variant="secondary" className="max-sm:w-full" asChild>
				<a href={publishingGuideUrl}>{copy.cta}</a>
			</Button>
		</section>
	)
}

export function MarketplaceUnavailable() {
	const router = useRouter()
	return (
		<div
			className="mt-12 flex flex-col items-center gap-2 rounded-[22px] px-6 py-12 text-center shadow-[inset_0_0_0_1px_var(--site-sep)]"
			role="alert"
		>
			<b className="text-[17px] leading-[1.3] font-semibold">{marketplaceCopy.unavailableTitle}</b>
			<span className="mb-2 text-[14px] leading-[1.4] text-text-secondary">
				{marketplaceCopy.unavailableBody}
			</span>
			<Button variant="secondary" onClick={() => void router.invalidate()}>
				{marketplaceCopy.unavailableAction}
			</Button>
		</div>
	)
}

export function StaleNotice() {
	return (
		<output className="mt-6 block rounded-xl bg-status-warning-background px-4 py-3 text-[13.5px] leading-[1.45] text-status-warning-foreground">
			{marketplaceCopy.staleNotice}
		</output>
	)
}
