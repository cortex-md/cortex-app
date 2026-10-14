import { RequireAccount } from "@/features/account/RequireAccount"
import { SyncSheet } from "@/features/sync/SyncSheet"

export default function Route() {
	return (
		<RequireAccount>
			<SyncSheet />
		</RequireAccount>
	)
}
