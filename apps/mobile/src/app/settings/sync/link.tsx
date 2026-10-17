import { RequireAccount } from "@/features/account/RequireAccount"
import { LinkVaultScreen } from "@/features/sync/LinkVaultScreen"

export default function Route() {
	return (
		<RequireAccount>
			<LinkVaultScreen />
		</RequireAccount>
	)
}
