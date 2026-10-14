import { RequireAccount } from "@/features/account/RequireAccount"
import { DeletedNoteDetailScreen } from "@/features/history/DeletedNoteDetailScreen"

export default function Route() {
	return (
		<RequireAccount>
			<DeletedNoteDetailScreen />
		</RequireAccount>
	)
}
