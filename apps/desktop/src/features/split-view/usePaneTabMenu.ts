import type { FileTabKind, Tab } from "@cortex/core"
import { useWorkspaceStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { usePluginStore } from "@cortex/plugin-host-web"
import { type MouseEvent, useCallback, useState } from "react"
import type { MenuItem } from "@/utils/context-menu"
import { NativeMenuActions } from "@/utils/context-menu"
import { createPluginContextMenuItems } from "../plugins/pluginContextMenu"

export interface PaneFallbackMenuState {
	tabId: string
	x: number
	y: number
}

type PaneTabCommand = (tabId: string, paneId: string) => void

interface PaneTabMenuOptions {
	paneId: string
	paneTabs: Tab[]
	closeTab: PaneTabCommand
	pinTab: PaneTabCommand
	linkedVaultId: string | null
	onViewHistory: (filePath: string) => void
}

const nativeMenu = new NativeMenuActions()

export const hasNativeTabMenu = () => getPlatform().capabilities.includes("menu")

function inferFileTabKind(filePath: string): FileTabKind {
	return filePath.toLocaleLowerCase().endsWith(".pdf") ? "pdf" : "markdown"
}

function isMarkdownTab(tab: Tab): boolean {
	return tab.tabType === "file" && (tab.fileKind ?? inferFileTabKind(tab.filePath)) === "markdown"
}

export function getTabPluginContext(tab: Tab) {
	return {
		location: "tab" as const,
		tabId: tab.id,
		filePath: tab.tabType === "file" ? tab.filePath : undefined,
		viewId: tab.tabType === "view" ? (tab.viewId ?? undefined) : undefined,
	}
}

export function usePaneTabMenu({
	paneId,
	paneTabs,
	closeTab,
	pinTab,
	linkedVaultId,
	onViewHistory,
}: PaneTabMenuOptions) {
	const [fallbackMenu, setFallbackMenu] = useState<PaneFallbackMenuState | null>(null)
	const pluginContextMenuItems = usePluginStore((state) => state.contextMenuItems)
	const findTab = useCallback(
		(tabId: string) => paneTabs.find((tab) => tab.id === tabId) ?? null,
		[paneTabs],
	)
	const getPluginTabMenuItems = useCallback(
		(tab: Tab) =>
			createPluginContextMenuItems(pluginContextMenuItems, "tab", getTabPluginContext(tab)),
		[pluginContextMenuItems],
	)

	const handleCloseOthers = useCallback(
		(tabId: string) => {
			for (const tab of paneTabs) {
				if (tab.id !== tabId && !tab.isPinned) {
					closeTab(tab.id, paneId)
				}
			}
		},
		[paneTabs, closeTab, paneId],
	)

	const handleCloseToRight = useCallback(
		(tabId: string) => {
			const tabIndex = paneTabs.findIndex((tab) => tab.id === tabId)
			for (let index = paneTabs.length - 1; index > tabIndex; index--) {
				const tab = paneTabs[index]
				if (!tab.isPinned) closeTab(tab.id, paneId)
			}
		},
		[paneTabs, closeTab, paneId],
	)

	const handleCopyPath = useCallback(
		(tabId: string) => {
			const tab = findTab(tabId)
			if (tab) void navigator.clipboard.writeText(tab.filePath)
		},
		[findTab],
	)

	const handleReveal = useCallback(
		async (tabId: string) => {
			const tab = findTab(tabId)
			if (tab) await getPlatform().dialog.revealFolder(tab.filePath)
		},
		[findTab],
	)

	const handleOpenInRight = useCallback(
		(tabId: string) => {
			const tab = findTab(tabId)
			if (tab?.filePath) {
				useWorkspaceStore.getState().openInSplit(tab.filePath, paneId, "horizontal")
			}
		},
		[findTab, paneId],
	)

	const handleViewHistory = useCallback(
		(tabId: string) => {
			const tab = findTab(tabId)
			if (tab) onViewHistory(tab.filePath)
		},
		[findTab, onViewHistory],
	)

	const dismissFallbackMenu = useCallback(() => {
		setFallbackMenu(null)
	}, [])

	const handleTabContextMenu = useCallback(
		(tabId: string, event: MouseEvent) => {
			event.preventDefault()

			if (!hasNativeTabMenu()) {
				setFallbackMenu({ tabId, x: event.clientX, y: event.clientY })
				return
			}

			const tab = findTab(tabId)
			if (!tab) return

			const items: MenuItem[] = [
				{
					id: "close",
					text: "Close",
					accelerator: "CmdOrCtrl+W",
					action: () => closeTab(tabId, paneId),
				},
				{
					id: "close-others",
					text: "Close Others",
					action: () => handleCloseOthers(tabId),
				},
				{
					id: "close-right",
					text: "Close to the Right",
					action: () => handleCloseToRight(tabId),
				},
				{ type: "separator" },
				{
					id: "pin",
					text: tab.isPinned ? "Unpin" : "Pin",
					action: () => pinTab(tabId, paneId),
				},
			]

			if (tab.tabType === "file") {
				items.push(
					{ type: "separator" },
					{
						id: "open-right-split",
						text: "Open in Right Split",
						action: () => handleOpenInRight(tabId),
					},
					{ type: "separator" },
					{
						id: "copy-path",
						text: "Copy Path",
						action: () => handleCopyPath(tabId),
					},
					{
						id: "reveal",
						text: "Reveal in Finder",
						action: () => handleReveal(tabId),
					},
				)

				if (linkedVaultId && isMarkdownTab(tab)) {
					items.push(
						{ type: "separator" },
						{
							id: "version-history",
							text: "Version History",
							action: () => handleViewHistory(tabId),
						},
					)
				}
			}

			items.push(...getPluginTabMenuItems(tab))

			void nativeMenu.showContextMenu({
				items,
				position: { x: event.clientX, y: event.clientY },
			})
		},
		[
			closeTab,
			findTab,
			handleCloseOthers,
			handleCloseToRight,
			handleCopyPath,
			handleOpenInRight,
			handleReveal,
			handleViewHistory,
			getPluginTabMenuItems,
			linkedVaultId,
			paneId,
			pinTab,
		],
	)

	return {
		fallbackMenu,
		fallbackTab: fallbackMenu ? findTab(fallbackMenu.tabId) : null,
		dismissFallbackMenu,
		handleCloseOthers,
		handleCloseToRight,
		handleCopyPath,
		handleReveal,
		handleOpenInRight,
		handleViewHistory,
		handleTabContextMenu,
	}
}
