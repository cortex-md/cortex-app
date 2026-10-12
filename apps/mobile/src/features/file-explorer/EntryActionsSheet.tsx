import { type FileEntryAction, getFileEntryActions } from "@cortex/core"
import type { FileEntry } from "@cortex/platform"
import {
	type PluginContextMenuAction,
	selectContextMenuItems,
	usePluginStore,
} from "@cortex/plugin-host-core"
import { Copy, Edit2, type LucideIcon, Move, Puzzle, Trash2 } from "lucide-react-native"

import { ActionSheet } from "@/components/ui/ActionSheet"
import { SheetActionButton } from "@/components/ui/SheetActionButton"
import { resolvePluginIcon } from "@/features/plugins/PluginIcon"

const entryActionIcons: Record<FileEntryAction["id"], LucideIcon> = {
	delete: Trash2,
	duplicate: Copy,
	move: Move,
	rename: Edit2,
}

export function EntryActionsSheet({
	entry,
	onAction,
	onDismiss,
	onPluginAction,
	submitting,
}: {
	entry: FileEntry | null
	onAction: (entry: FileEntry, action: FileEntryAction) => void
	onDismiss: () => void
	onPluginAction: (action: PluginContextMenuAction) => void
	submitting: boolean
}) {
	const contextMenuItems = usePluginStore((state) => state.contextMenuItems)
	const actions = entry
		? getFileEntryActions({ filePath: entry.path, isDirectory: entry.isDir })
		: []
	const pluginActions = entry
		? selectContextMenuItems({ contextMenuItems }, "file", {
				filePath: entry.path,
				location: "file",
			})
		: []

	return (
		<ActionSheet
			isPresented={entry !== null}
			onDismiss={onDismiss}
			sectionTitle={entry?.isDir ? "Folder actions" : "Note actions"}
			supportingText={entry?.path ?? ""}
			title={entry?.name ?? ""}
		>
			{actions.map((action) =>
				action.visible ? (
					<SheetActionButton
						Icon={entryActionIcons[action.id]}
						destructive={action.destructive}
						disabled={submitting}
						key={action.id}
						label={action.label}
						onPress={() => {
							if (entry) onAction(entry, action)
						}}
					/>
				) : null,
			)}
			{pluginActions.map((action) => (
				<SheetActionButton
					Icon={resolvePluginIcon(action.icon) ?? Puzzle}
					disabled={submitting}
					key={action.key}
					label={action.label}
					onPress={() => onPluginAction(action)}
				/>
			))}
		</ActionSheet>
	)
}
