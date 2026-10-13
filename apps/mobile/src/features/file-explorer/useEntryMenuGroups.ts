import type { FileEntry } from "@cortex/platform"
import { selectContextMenuItems, usePluginStore } from "@cortex/plugin-host-core"

import type { MenuGroup } from "@/components/ui/menuTypes"
import { buildEntryMenuGroups } from "@/features/file-explorer/entryActions"

export function useEntryMenuGroups(onNavigate?: () => void): (entry: FileEntry) => MenuGroup[] {
	const contextMenuItems = usePluginStore((state) => state.contextMenuItems)
	return (entry) =>
		buildEntryMenuGroups(
			entry,
			selectContextMenuItems({ contextMenuItems }, "file", {
				filePath: entry.path,
				location: "file",
			}),
			onNavigate,
		)
}
