import type { EntryContextMenuProps } from "@/features/file-explorer/entryContextMenuTypes"

export function EntryContextMenu({ children, onPress }: EntryContextMenuProps) {
	return children({ onPress })
}
