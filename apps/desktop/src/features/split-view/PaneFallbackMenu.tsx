import type { Tab } from "@cortex/core"
import { usePluginStore } from "@cortex/plugin-host-web"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
} from "@cortex/ui"
import {
	ClipboardCopyIcon,
	Columns2Icon,
	FolderIcon,
	HistoryIcon,
	PinIcon,
	PinOffIcon,
	XIcon,
} from "lucide-react"
import { useMemo } from "react"
import { NoteDropdownMenuItems } from "../file-explorer/NoteMenuItems"
import { createPluginContextMenuItems } from "../plugins/pluginContextMenu"
import { getTabPluginContext, hasNativeTabMenu, type PaneFallbackMenuState } from "./usePaneTabMenu"

interface PaneFallbackMenuProps {
	menu: PaneFallbackMenuState | null
	tab: Tab | null
	showVersionHistory: boolean
	onDismiss: () => void
	onClose: (tabId: string) => void
	onCloseOthers: (tabId: string) => void
	onCloseToRight: (tabId: string) => void
	onPin: (tabId: string) => void
	onOpenInRight: (tabId: string) => void
	onCopyPath: (tabId: string) => void
	onReveal: (tabId: string) => Promise<void>
	onViewHistory: (tabId: string) => void
}

export function PaneFallbackMenu({
	menu,
	tab,
	showVersionHistory,
	onDismiss,
	onClose,
	onCloseOthers,
	onCloseToRight,
	onPin,
	onOpenInRight,
	onCopyPath,
	onReveal,
	onViewHistory,
}: PaneFallbackMenuProps) {
	const pluginContextMenuItems = usePluginStore((state) => state.contextMenuItems)
	const pluginTabMenuItems = useMemo(
		() =>
			tab
				? createPluginContextMenuItems(pluginContextMenuItems, "tab", getTabPluginContext(tab))
				: [],
		[pluginContextMenuItems, tab],
	)
	if (hasNativeTabMenu() || !tab || !menu) return null

	return (
		<DropdownMenu
			open={true}
			onOpenChange={(open) => {
				if (!open) onDismiss()
			}}
		>
			<DropdownMenuContent
				onCloseAutoFocus={(event) => event.preventDefault()}
				style={{
					position: "fixed",
					left: menu.x,
					top: menu.y,
				}}
			>
				<DropdownMenuItem onSelect={() => onClose(tab.id)}>
					<XIcon />
					Close
					<DropdownMenuShortcut>⌘W</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={() => onCloseOthers(tab.id)}>Close Others</DropdownMenuItem>
				<DropdownMenuItem onSelect={() => onCloseToRight(tab.id)}>
					Close to the Right
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={() => onPin(tab.id)}>
					{tab.isPinned ? <PinOffIcon /> : <PinIcon />}
					{tab.isPinned ? "Unpin" : "Pin"}
				</DropdownMenuItem>
				{tab.tabType === "file" && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={() => onOpenInRight(tab.id)}>
							<Columns2Icon />
							Open in Right Split
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={() => onCopyPath(tab.id)}>
							<ClipboardCopyIcon />
							Copy Path
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => void onReveal(tab.id)}>
							<FolderIcon />
							Reveal in Finder
						</DropdownMenuItem>
						{showVersionHistory && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem onSelect={() => onViewHistory(tab.id)}>
									<HistoryIcon />
									Version History
								</DropdownMenuItem>
							</>
						)}
					</>
				)}
				<NoteDropdownMenuItems items={pluginTabMenuItems} />
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
