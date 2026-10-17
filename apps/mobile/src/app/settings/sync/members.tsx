import { RequireAccount } from "@/features/account/RequireAccount"
import { MembersScreen } from "@/features/sync/MembersScreen"

export default function Route() {
	return (
		<RequireAccount>
			<MembersScreen />
		</RequireAccount>
	)
}
