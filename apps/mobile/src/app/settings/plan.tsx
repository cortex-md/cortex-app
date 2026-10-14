import { RequireAccount } from "@/features/account/RequireAccount"
import { PlanScreen } from "@/features/settings/PlanScreen"

export default function Route() {
	return (
		<RequireAccount>
			<PlanScreen />
		</RequireAccount>
	)
}
