import type { EntryContextMenuProps } from "@/features/file-explorer/entryContextMenuTypes"
import { showEntryMenu } from "@/features/file-explorer/entryMenuStore"
import { triggerSelectionHaptic } from "@/utils/haptics"

export function EntryContextMenu({ children, groups, header, onPress }: EntryContextMenuProps) {
	return children({
		onLongPress:
			groups.length > 0
				? (event) => {
						triggerSelectionHaptic()
						showEntryMenu(
							{ groups, header },
							{ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY },
						)
					}
				: undefined,
		onPress,
	})
}
