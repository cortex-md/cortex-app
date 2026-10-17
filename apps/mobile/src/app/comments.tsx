import { RequireAccount } from "@/features/account/RequireAccount"
import { CommentsSheet } from "@/features/comments/CommentsSheet"

export default function Route() {
	return (
		<RequireAccount>
			<CommentsSheet />
		</RequireAccount>
	)
}
