import {
	CLOUD_SERVER_LABEL,
	describeServerUrl,
	resolveSyncServerUrl,
	useRemoteVaultStore,
	useUIStore,
} from "@cortex/core"
import { Alert, AlertDescription, AlertTitle, Button } from "@cortex/ui"
import { LogIn } from "lucide-react"

export function SignedOutNotice() {
	const openAuth = useUIStore((state) => state.openAuth)
	const syncConfig = useRemoteVaultStore((state) => state.syncConfig)
	const serverLabel = syncConfig.selfHosted
		? describeServerUrl(resolveSyncServerUrl(syncConfig))
		: CLOUD_SERVER_LABEL
	return (
		<Alert>
			<LogIn />
			<AlertTitle>Sign in to sync this vault</AlertTitle>
			<AlertDescription>
				<div className="flex flex-col gap-3">
					<p>Sign in or create an account on {serverLabel} to keep this vault on every device.</p>
					<Button className="w-fit" onClick={() => openAuth("login", "sync")}>
						Sign in
					</Button>
				</div>
			</AlertDescription>
		</Alert>
	)
}
