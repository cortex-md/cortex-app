import { RequireAccount } from "@/features/account/RequireAccount"
import { SyncOverviewScreen } from "@/features/sync/SyncOverviewScreen"

export default function Route() {
	return (
		<RequireAccount>
			<SyncOverviewScreen />
		</RequireAccount>
	)
}
