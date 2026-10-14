import { RequireAccount } from "@/features/account/RequireAccount"
import { DeletedNotesScreen } from "@/features/history/DeletedNotesScreen"

export default function Route() {
	return (
		<RequireAccount>
			<DeletedNotesScreen />
		</RequireAccount>
	)
}
