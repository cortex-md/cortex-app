import { ChangePasswordScreen } from "@/features/account/ChangePasswordScreen"
import { RequireAccount } from "@/features/account/RequireAccount"

export default function Route() {
	return (
		<RequireAccount>
			<ChangePasswordScreen />
		</RequireAccount>
	)
}
