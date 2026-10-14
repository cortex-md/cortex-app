import { RequireAccount } from "@/features/account/RequireAccount"
import { SyncPreferencesScreen } from "@/features/sync/SyncPreferencesScreen"

export default function Route() {
	return (
		<RequireAccount>
			<SyncPreferencesScreen />
		</RequireAccount>
	)
}
