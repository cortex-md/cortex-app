import { RequireAccount } from "@/features/account/RequireAccount"
import { PeopleSheet } from "@/features/collab/PeopleSheet"

export default function Route() {
	return (
		<RequireAccount>
			<PeopleSheet />
		</RequireAccount>
	)
}
