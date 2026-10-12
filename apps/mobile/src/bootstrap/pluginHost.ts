import { useSyncExternalStore } from "react"

import { workspaceChannel } from "@/features/workspace/workspaceChannel"

/** Native plugin host API: mirrors the plugin host that runs in the workspace WebView. */
export const mobilePluginHost = workspaceChannel.pluginHost

export function useMobileCommunityStyles(): string {
	return useSyncExternalStore(
		workspaceChannel.subscribeCommunityStyles,
		workspaceChannel.getCommunityStyles,
	)
}
