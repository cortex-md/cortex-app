import { Button } from "@cortex/ui/button"
import { ArrowLeft, CreditCard } from "lucide-react"
import { LandingFooter } from "../landing/sections/LandingFooter"
import { SiteHeader } from "../site/SiteHeader"

export function BillingCancelledPage() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<SiteHeader homeHrefPrefix="/" surface="billing" />
			<main id="main-content" tabIndex={-1}>
				<section className="mx-auto flex min-h-[calc(100vh-120px)] w-[min(760px,calc(100%_-_48px))] items-center pt-32 pb-20 max-sm:w-[min(100%_-_28px,520px)]">
					<div className="w-full rounded-xl bg-bg-elevated p-8 shadow-[0_0_0_1px_var(--border-subtle),0_18px_48px_rgba(17,19,26,0.08)] max-sm:p-6">
						<span
							className="grid size-11 place-items-center rounded-lg bg-accent-amber-subtle text-accent-amber-text"
							aria-hidden="true"
						>
							<CreditCard className="size-5" />
						</span>
						<p className="mt-7 mb-0 text-[15px] leading-6 font-medium text-text-muted">Billing</p>
						<h1 className="mt-3 mb-0 text-balance text-[clamp(34px,5vw,56px)] leading-[1.04] font-semibold tracking-[-0.025em] text-text-primary">
							Checkout was cancelled.
						</h1>
						<p className="mt-5 mb-0 max-w-[520px] text-[16px] leading-7 text-text-secondary">
							Your plan was not changed. You can restart checkout when you are ready, or return to
							pricing.
						</p>
						<div className="mt-8 flex flex-wrap gap-3">
							<Button asChild>
								<a href="/billing">Try checkout again</a>
							</Button>
							<Button variant="outline" asChild>
								<a href="/#pricing">
									<ArrowLeft className="size-4" aria-hidden="true" />
									Back to pricing
								</a>
							</Button>
						</div>
					</div>
				</section>
			</main>
			<LandingFooter homeHrefPrefix="/" />
		</div>
	)
}
