import { useRemoteVaultStore, useSubscriptionStore } from "@cortex/core"
import { Alert, AlertDescription, AlertTitle, Button } from "@cortex/ui"
import { CreditCard } from "lucide-react"

export function SubscriptionRequiredNotice() {
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const block = useSubscriptionStore((state) => state.block)
	const loading = useSubscriptionStore((state) => state.loading)
	const openBillingPage = useSubscriptionStore((state) => state.openBillingPage)

	if (syncConfig.selfHosted || !block) return null

	const handleOpenBilling = () => {
		void openBillingPage().catch(() => {})
	}

	return (
		<Alert variant="destructive">
			<CreditCard />
			<AlertTitle>
				{block.code === "subscription_expired" ? "Plan expired" : "Plan required"}
			</AlertTitle>
			<AlertDescription>
				<div className="flex flex-col gap-3">
					<p>{block.message}</p>
					<Button size="sm" className="w-fit" onClick={handleOpenBilling} disabled={loading}>
						{loading ? "Opening plan page" : "Manage plan"}
					</Button>
				</div>
			</AlertDescription>
		</Alert>
	)
}
