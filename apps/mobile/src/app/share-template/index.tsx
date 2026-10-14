import { RequireAccount } from "@/features/account/RequireAccount"
import { ShareTemplateScreen } from "@/features/share/ShareTemplateSheet"

export default function Route() {
	return (
		<RequireAccount>
			<ShareTemplateScreen />
		</RequireAccount>
	)
}
