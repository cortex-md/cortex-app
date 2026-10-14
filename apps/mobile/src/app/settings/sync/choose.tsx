import { RequireAccount } from "@/features/account/RequireAccount"
import { LinkVaultChooseScreen } from "@/features/sync/LinkVaultChooseScreen"

export default function Route() {
	return (
		<RequireAccount>
			<LinkVaultChooseScreen />
		</RequireAccount>
	)
}
