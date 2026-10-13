import { getErrorMessage } from "@cortex/core"
import { Platform } from "react-native"

import { FormRow, FormSection, NativeForm } from "@/components/ui/Form"
import {
	getHostedSyncPlan,
	openUpgradeCheckout,
	useHostedSyncEntitlement,
} from "@/features/billing/billingAdapter"
import { toast } from "@/features/feedback/useToast"

const PURCHASE_NOTE =
	Platform.OS === "ios"
		? "[Purchase path on iOS: App Store in-app purchase or web checkout]"
		: "[Purchase path on Android: Google Play Billing or web checkout]"

async function upgrade(): Promise<void> {
	try {
		await openUpgradeCheckout()
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
			<FormSection footer={`${plan.selfHostingNote}\n${PURCHASE_NOTE}`}>
				<FormRow onPress={() => void upgrade()} tint title={plan.cta} />
			</FormSection>
		</NativeForm>
	)
}
