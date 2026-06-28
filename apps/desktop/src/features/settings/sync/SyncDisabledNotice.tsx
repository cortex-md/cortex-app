import { Alert, AlertDescription, AlertTitle } from "@cortex/ui"
import { CloudOff } from "lucide-react"

export function SyncDisabledNotice({ description }: { description: string }) {
	return (
		<Alert>
			<CloudOff />
			<AlertTitle>Sync is disabled</AlertTitle>
			<AlertDescription>{description}</AlertDescription>
		</Alert>
	)
}
