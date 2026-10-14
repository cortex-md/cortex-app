import { getErrorMessage } from "@cortex/core"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import {
	getHostedSyncPlan,
	openUpgradeCheckout,
	useHostedSyncEntitlement,
} from "@/features/billing/billingAdapter"
import { toast } from "@/features/feedback/useToast"

async function upgrade(): Promise<void> {
	try {
		const result = await openUpgradeCheckout()
		if (result === "purchased") toast("Hosted Sync is active")
		else if (result === "pending") toast("Checking your purchase…")
	} catch (error) {
		toast(getErrorMessage(error))
	}
}

export function PlanScreen() {
	const plan = getHostedSyncPlan()
	const { entitled, planLabel } = useHostedSyncEntitlement()

	return (
		<NativeForm>
			<FormSection footer={plan.tagline}>
				<FormRow subtitle={plan.body} title={plan.headline} />
				<FormRow title="Current plan" value={entitled ? planLabel : "Plan required"} />
				<FormRow title={plan.name} value={`${plan.price} ${plan.period}`} />
			</FormSection>
			<FormSection footer={`${plan.selfHostingNote}\n${plan.purchaseNote}`}>
				<FormRow onPress={() => void upgrade()} tint title={plan.cta} />
			</FormSection>
		</NativeForm>
	)
}
