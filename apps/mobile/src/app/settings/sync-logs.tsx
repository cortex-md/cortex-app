import { RequireAccount } from "@/features/account/RequireAccount"
import { SyncLogsScreen } from "@/features/sync/SyncLogsScreen"

export default function Route() {
	return (
		<RequireAccount>
			<SyncLogsScreen />
		</RequireAccount>
	)
}
