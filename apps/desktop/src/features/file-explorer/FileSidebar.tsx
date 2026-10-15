import { executeCommand } from "@cortex/commands"
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
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@cortex/ui"
import {
	FilePlusIcon,
	FolderPlusIcon,
	LayoutTemplateIcon,
	PlusIcon,
	RepeatIcon,
	Table2Icon,
} from "lucide-react"
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { useCommandHotkey } from "../../hooks/useCommandHotkey"
import { useContextMenu } from "../context-menu/useContextMenu"
import { FileSidebarTree } from "./FileSidebarTree"
import { type FileExplorerCommandId, setFileExplorerCommandHandler } from "./fileExplorerCommands"
import { createFileExplorerHotkeyBindings } from "./fileExplorerKeyboard"
import { type FileCreateType, useFileSidebarActions } from "./useFileSidebarActions"
import { useFileSidebarTreeModel } from "./useFileSidebarTreeModel"

interface FileSidebarHeaderProps {
	vaultPath: string
	onCreate: (parentPath: string, createType: FileCreateType) => void
}

function FileSidebarHeader({ vaultPath, onCreate }: FileSidebarHeaderProps) {
	const canCreateAtRoot = useCanWriteVaultPath(vaultPath, true)
	const newNoteKeys = useCommandHotkey("file.new")
	const newDatabaseKeys = useCommandHotkey("database.new")
	const fromTemplateKeys = useCommandHotkey("templates.create-note")
	const pendingCreateRef = useRef<(() => void) | null>(null)
	return (
		<div className="file-sidebar-header flex items-center justify-between flex-shrink-0">
			<span className="file-sidebar-title">Files</span>
			{canCreateAtRoot && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className="sidebar-action-button text-text-muted hover:text-text-primary hover:bg-bg-hover"
							title="Create"
							aria-label="Create"
						>
							<PlusIcon size={16} />
						</Button>
					</DropdownMenuTrigger>
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
						<DropdownMenuItem
							onSelect={() => {
								pendingCreateRef.current = () => onCreate(vaultPath, "file")
							}}
						>
							<FilePlusIcon />
							Note
							{newNoteKeys && <DropdownMenuShortcut>{newNoteKeys}</DropdownMenuShortcut>}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() => {
								pendingCreateRef.current = () => executeCommand("templates.create-note")
							}}
						>
							<LayoutTemplateIcon />
							Note from a template…
							{fromTemplateKeys && <DropdownMenuShortcut>{fromTemplateKeys}</DropdownMenuShortcut>}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() => {
								pendingCreateRef.current = () => executeCommand("database.new")
							}}
						>
							<Table2Icon />
							Database
							{newDatabaseKeys && <DropdownMenuShortcut>{newDatabaseKeys}</DropdownMenuShortcut>}
						</DropdownMenuItem>
						<DropdownMenuItem
							onSelect={() => {
								pendingCreateRef.current = () => onCreate(vaultPath, "folder")
							}}
						>
							<FolderPlusIcon />
							Folder
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onSelect={() => {
								pendingCreateRef.current = () => executeCommand("database.convert-folder")
							}}
						>
							<RepeatIcon />
							Turn a folder into a database
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onSelect={() => {
								pendingCreateRef.current = () => executeCommand("templates.new")
							}}
						>
							<PlusIcon />
							New template…
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	)
}

export function FileSidebar() {
	const vault = useVaultStore((s) => s.vault)
	const files = useVaultStore((s) => s.files)
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
			files,
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
