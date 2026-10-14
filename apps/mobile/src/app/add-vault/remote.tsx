import { RequireAccount } from "@/features/account/RequireAccount"
import { AddVaultRemoteScreen } from "@/features/vault/AddVaultRemoteScreen"

export default function Route() {
	return (
		<RequireAccount>
			<AddVaultRemoteScreen />
		</RequireAccount>
	)
}
