import { Button } from "@cortex/ui/button"
import { ArrowLeft, Check, CreditCard } from "lucide-react"
import { cortexAppUrl } from "../../config/deepLinks"
import { billingCancelledCopy, billingSuccessCopy } from "../../content/callback"
import { CallbackCard, CallbackSteps, CallbackText } from "../callback/CallbackCard"

export function BillingCancelledPage() {
	return (
		<CallbackCard
			icon={<CreditCard />}
			tone="warn"
			title={billingCancelledCopy.title}
			actions={
				<>
					<Button size="lg" asChild>
						<a href={billingCancelledCopy.retryHref}>{billingCancelledCopy.retry}</a>
					</Button>
					<Button size="lg" variant="ghost" asChild>
						<a href={billingCancelledCopy.backHref}>
							<ArrowLeft aria-hidden="true" />
							{billingCancelledCopy.back}
						</a>
					</Button>
				</>
			}
		>
			<CallbackText>{billingCancelledCopy.body}</CallbackText>
		</CallbackCard>
	)
}

export function BillingSuccessPage({ email }: { email: string | null }) {
	return (
		<CallbackCard
			icon={<Check />}
			tone="ok"
			title={billingSuccessCopy.title}
			actions={
				<Button size="lg" asChild>
					<a href={cortexAppUrl}>{billingSuccessCopy.cta}</a>
				</Button>
			}
			fine={billingSuccessCopy.receipt(email)}
		>
			<CallbackText>{billingSuccessCopy.body}</CallbackText>
			<CallbackSteps steps={billingSuccessCopy.steps} />
		</CallbackCard>
	)
}
