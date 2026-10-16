import { useRemoteVaultStore, useSubscriptionStore } from "@cortex/core"
import { Alert, AlertDescription, AlertTitle, Button } from "@cortex/ui"
import { CreditCard } from "lucide-react"

export function useCloudPlanBlocked(): boolean {
	const selfHosted = useRemoteVaultStore((state) => state.syncConfig.selfHosted)
	const block = useSubscriptionStore((state) => state.block)
	return !selfHosted && block !== null
}

export function SubscriptionRequiredNotice() {
	const blocked = useCloudPlanBlocked()
	const block = useSubscriptionStore((state) => state.block)
	const loading = useSubscriptionStore((state) => state.loading)
	const openBillingPage = useSubscriptionStore((state) => state.openBillingPage)

	if (!blocked || !block) return null

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
					<Button className="w-fit" onClick={handleOpenBilling} disabled={loading}>
						{loading ? "Opening plan page" : "Manage plan"}
					</Button>
				</div>
			</AlertDescription>
		</Alert>
	)
}
