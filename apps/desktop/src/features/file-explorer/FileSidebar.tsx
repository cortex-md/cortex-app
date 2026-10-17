import { useHotkeysStore } from "@cortex/commands/hotkeys"
import {
	selectActiveTabFilePath,
	useCanWriteVaultPath,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { useSettingsStore } from "@cortex/settings"
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
	SimpleTooltip,
} from "@cortex/ui"
import { FolderPlusIcon, PlusIcon } from "lucide-react"
import {
	type RefObject,
	useCallback,
	useEffect,
	useEffectEvent,
	useMemo,
	useRef,
	useState,
} from "react"
import type { MenuItem } from "@/utils/context-menu"
import { MenuItemList, useContextMenu } from "../context-menu/useContextMenu"
import { FileSidebarTree } from "./FileSidebarTree"
import { type FileExplorerCommandId, setFileExplorerCommandHandler } from "./fileExplorerCommands"
import { createFileExplorerHotkeyBindings } from "./fileExplorerKeyboard"
import { buildCreateMenuItems } from "./fileMenu"
import { type FileCreateType, useFileSidebarActions } from "./useFileSidebarActions"
import { useFileSidebarTreeModel } from "./useFileSidebarTreeModel"

function deferMenuActions(
	items: MenuItem[],
	pendingRef: RefObject<(() => void) | null>,
): MenuItem[] {
	return items.map((item) => {
		if (item.type === "separator" || item.type === "label" || item.type === "submenu") return item
		const action = item.action
		return action
			? {
					...item,
					action: () => {
						pendingRef.current = () => void action()
					},
				}
			: item
	})
}

interface FileSidebarHeaderProps {
	vaultPath: string
	onCreate: (parentPath: string, createType: FileCreateType) => void
}

function FileSidebarHeader({ vaultPath, onCreate }: FileSidebarHeaderProps) {
	const canCreateAtRoot = useCanWriteVaultPath(vaultPath, true)
	const pendingCreateRef = useRef<(() => void) | null>(null)
	const createItems = deferMenuActions(
		buildCreateMenuItems({
			onNewNote: () => onCreate(vaultPath, "file"),
			onNewFolder: () => onCreate(vaultPath, "folder"),
		}),
		pendingCreateRef,
	)
	return (
		<div className="file-sidebar-header flex items-center flex-shrink-0 gap-0.5">
			<span className="file-sidebar-title mr-auto">Files</span>
			{canCreateAtRoot && (
				<DropdownMenu>
					<SimpleTooltip label="Create" side="bottom">
						<DropdownMenuTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								className="file-sidebar-header-action"
								aria-label="Create"
							>
								<PlusIcon size={14} />
							</Button>
						</DropdownMenuTrigger>
					</SimpleTooltip>
					<DropdownMenuContent
						align="end"
						onCloseAutoFocus={(event) => {
							const action = pendingCreateRef.current
							pendingCreateRef.current = null
							if (!action) return
							event.preventDefault()
							action()
						}}
					>
						<MenuItemList items={createItems} />
					</DropdownMenuContent>
				</DropdownMenu>
			)}
			{canCreateAtRoot && (
				<SimpleTooltip label="New folder" side="bottom">
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="file-sidebar-header-action"
						aria-label="New folder"
						onClick={() => onCreate(vaultPath, "folder")}
					>
						<FolderPlusIcon size={14} />
					</Button>
				</SimpleTooltip>
			)}
		</div>
	)
}

export function FileSidebar() {
	const vault = useVaultStore((s) => s.vault)
	const activeFilePath = useWorkspaceStore(selectActiveTabFilePath)
	const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
	const [focusedPathOverride, setFocusedPathOverride] = useState<string | null>(null)
	const vimMode = useSettingsStore((state) => state.settings.editor.vimMode)
	const hotkeyBindings = useHotkeysStore((state) => state.bindings)

	const treeScrollRef = useRef<HTMLDivElement>(null)
	const vaultPath = vault?.path ?? ""
	const fileExplorerBindings = useMemo(
		() => createFileExplorerHotkeyBindings(hotkeyBindings),
		[hotkeyBindings],
	)

	const handleToggle = useCallback((path: string) => {
		setExpanded((prev) => {
			const next = new Set(prev)
			if (next.has(path)) next.delete(path)
			else next.add(path)
			return next
		})
	}, [])

	const ensureExpanded = useCallback((path: string) => {
		setExpanded((prev) => {
			if (prev.has(path)) return prev
			const next = new Set(prev)
			next.add(path)
			return next
		})
	}, [])

	const { showMenu, menu } = useContextMenu()
	const { uiState, actions } = useFileSidebarActions({
		vaultPath,
		treeScrollRef,
		toggle: handleToggle,
		ensureExpanded,
		focusPath: setFocusedPathOverride,
		showMenu,
	})
	const { renamingPath, creatingIn, creatingType } = uiState

	const { tree, rows, nodeRows, nodeRowIndexByPath, nodeByPath, focusedPath, rowVirtualizer } =
		useFileSidebarTreeModel({
			vaultPath,
			hasVault: Boolean(vault),
			expanded,
			creatingIn,
			creatingType,
			activeFilePath,
			focusedPathOverride,
			treeScrollRef,
		})

	const handleExplorerCommand = useEffectEvent(
		(commandId: FileExplorerCommandId, filePath: string | null) => {
			const node = nodeByPath.get(filePath ?? focusedPath ?? "")
			if (node) actions.runCommand(commandId, node)
		},
	)
	useEffect(() => setFileExplorerCommandHandler(handleExplorerCommand), [])

	if (!vault) {
		return
	}

	return (
		<div className="file-sidebar flex flex-col h-full px-1.5 overflow-hidden">
			<FileSidebarHeader vaultPath={vault.path} onCreate={actions.startCreate} />
			<FileSidebarTree
				tree={tree}
				rows={rows}
				nodeRows={nodeRows}
				nodeRowIndexByPath={nodeRowIndexByPath}
				isCreatingAtRoot={creatingIn === vault.path}
				activeFilePath={activeFilePath}
				focusedPath={focusedPath}
				vaultPath={vault.path}
				expanded={expanded}
				renamingPath={renamingPath}
				vimMode={vimMode}
				treeScrollRef={treeScrollRef}
				rowVirtualizer={rowVirtualizer}
				fileExplorerBindings={fileExplorerBindings}
				actions={actions}
			/>
			{menu}
		</div>
	)
}
