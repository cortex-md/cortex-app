import { getPluginEnableConfirmation } from "@cortex/marketplace"
import { getPlatform } from "@cortex/platform"
import type { PluginRecord } from "@cortex/plugin-host-core"
import { Alert, AlertDescription, Button } from "@cortex/ui"
import { ShieldAlert } from "lucide-react"
import { pluginHost } from "../../bootstrap/pluginHost"
import { setCommunityPluginsAllowed } from "./communityPluginsSetting"

export { setCommunityPluginsAllowed, useCommunityPluginsAllowed } from "./communityPluginsSetting"

export async function enablePluginWithConsent(record: PluginRecord): Promise<boolean> {
	if (
		record.community &&
		!(await getPlatform().dialog.showConfirm(getPluginEnableConfirmation(record.manifest)))
	) {
		return false
	}
	await pluginHost.enablePlugin(record.manifest.id)
	return true
}

export function CommunityPluginsNotice({ className }: { className?: string }) {
	return (
		<Alert className={className}>
			<ShieldAlert size={14} />
			<AlertDescription className="flex min-w-0 items-center justify-between gap-3">
				<span>Community plugins are turned off.</span>
				<Button variant="ghost" size="xs" onClick={() => void setCommunityPluginsAllowed(true)}>
					Turn on
				</Button>
			</AlertDescription>
		</Alert>
	)
}
