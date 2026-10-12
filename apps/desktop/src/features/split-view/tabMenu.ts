import { canReadVaultPath, inferFileTabKind, type Tab } from "@cortex/core"
import type { ContextMenuActionContext } from "@cortex.md/api"
import { PinIcon, PinOffIcon, XIcon } from "lucide-react"
import {
	commandMenuItem,
	compactMenuItems,
	getPluginMenuItems,
	MENU_SEPARATOR,
	type MenuItem,
} from "@/utils/context-menu"
import { isSyncLinked } from "../file-explorer/fileMenu"

function getTabPluginContext(tab: Tab): ContextMenuActionContext {
	return {
		location: "tab",
		tabId: tab.id,
		filePath: tab.tabType === "file" ? tab.filePath : undefined,
		viewId: tab.tabType === "view" ? (tab.viewId ?? undefined) : undefined,
	}
}

export function buildTabMenuItems(tab: Tab, paneId: string): MenuItem[] {
	const tabPayload = { tabId: tab.id, paneId }
	const filePayload = { filePath: tab.filePath }
	const isFile = tab.tabType === "file"
	const isMarkdown = isFile && (tab.fileKind ?? inferFileTabKind(tab.filePath)) === "markdown"

	return compactMenuItems([
		commandMenuItem("file.close-tab", {
			id: "close",
			text: "Close",
			icon: XIcon,
			payload: tabPayload,
		}),
		commandMenuItem("tabs.close-others", {
			id: "close-others",
			text: "Close Others",
			payload: tabPayload,
		}),
		commandMenuItem("tabs.close-to-right", {
			id: "close-right",
			text: "Close to the Right",
			payload: tabPayload,
		}),
		MENU_SEPARATOR,
		commandMenuItem("tabs.toggle-pin", {
			id: "pin",
			text: tab.isPinned ? "Unpin" : "Pin",
			icon: tab.isPinned ? PinOffIcon : PinIcon,
			payload: tabPayload,
		}),
		MENU_SEPARATOR,
		isFile &&
			commandMenuItem("file.open-in-right-split", {
				id: "open-right-split",
				text: "Open in Right Split",
				payload: { filePath: tab.filePath, paneId },
			}),
		MENU_SEPARATOR,
		isFile &&
			commandMenuItem("file.copy-absolute-path", {
				id: "copy-path",
				text: "Copy Path",
				payload: filePayload,
			}),
		isFile &&
			commandMenuItem("file.reveal", {
				id: "reveal",
				text: "Reveal in Finder",
				payload: filePayload,
			}),
		MENU_SEPARATOR,
		isMarkdown &&
			isSyncLinked() &&
			commandMenuItem("sync.share-note", {
				id: "share-note",
				text: "Share…",
				payload: filePayload,
			}),
		isMarkdown &&
			canReadVaultPath(tab.filePath) &&
			commandMenuItem("sync.show-version-history", {
				id: "version-history",
				text: "Version History",
				payload: filePayload,
			}),
		...getPluginMenuItems(getTabPluginContext(tab)),
	])
}
