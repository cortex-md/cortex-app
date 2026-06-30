import {
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
} from "@cortex/ui"
import {
	BookmarkMinus,
	BookmarkPlus,
	ClipboardCopy,
	Cloud,
	CloudOff,
	Columns2,
	Copy,
	Download,
	ExternalLink,
	FileText,
	Folder,
	History,
	Pencil,
	Table,
	Trash2,
} from "lucide-react"
import type { ReactNode } from "react"
import type { MenuItem } from "@/utils/context-menu"

interface NoteMenuItemsProps {
	items: MenuItem[]
}

function getMenuIcon(id: string): ReactNode {
	switch (id) {
		case "open-new-tab":
			return <ExternalLink />
		case "open-right-split":
			return <Columns2 />
		case "make-copy":
			return <Copy />
		case "export-note":
			return <Download />
		case "export-html":
			return <FileText />
		case "export-pdf":
			return <Download />
		case "export-csv":
			return <Table />
		case "copy-path":
			return <ClipboardCopy />
		case "reveal":
			return <Folder />
		case "add-bookmark":
			return <BookmarkPlus />
		case "remove-bookmark":
			return <BookmarkMinus />
		case "version-history":
			return <History />
		case "include-in-sync":
			return <Cloud />
		case "exclude-from-sync":
			return <CloudOff />
		case "rename":
			return <Pencil />
		case "delete":
			return <Trash2 />
		default:
			return null
	}
}

function getShortcut(accelerator: string | undefined): string | null {
	if (!accelerator) return null
	return accelerator.replace("CmdOrCtrl", "⌘").replace("Shift", "⇧").replace("Alt", "⌥")
}

function getSeparatorKey(items: MenuItem[], separator: MenuItem): string {
	const separatorIndex = items.indexOf(separator)
	const previous = items[separatorIndex - 1]
	const next = items[separatorIndex + 1]
	const previousId = previous && previous.type !== "separator" ? previous.id : "start"
	const nextId = next && next.type !== "separator" ? next.id : "end"
	return `separator-${previousId}-${nextId}`
}

export function NoteDropdownMenuItems({ items }: NoteMenuItemsProps) {
	return items.map((item) => {
		if (item.type === "separator") {
			return <DropdownMenuSeparator key={getSeparatorKey(items, item)} />
		}

		if (item.type === "submenu") {
			return (
				<DropdownMenuSub key={item.id}>
					<DropdownMenuSubTrigger>
						{getMenuIcon(item.id)}
						{item.text}
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<NoteDropdownMenuItems items={item.items} />
					</DropdownMenuSubContent>
				</DropdownMenuSub>
			)
		}

		const shortcut = getShortcut(item.accelerator)
		return (
			<DropdownMenuItem
				key={item.id}
				disabled={item.enabled === false}
				variant={item.destructive ? "destructive" : "default"}
				onSelect={() => void item.action?.()}
			>
				{getMenuIcon(item.id)}
				{item.text}
				{shortcut && <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>}
			</DropdownMenuItem>
		)
	})
}

export function NoteContextMenuItems({ items }: NoteMenuItemsProps) {
	return items.map((item) => {
		if (item.type === "separator") {
			return <ContextMenuSeparator key={getSeparatorKey(items, item)} />
		}

		if (item.type === "submenu") {
			return (
				<ContextMenuSub key={item.id}>
					<ContextMenuSubTrigger>
						{getMenuIcon(item.id)}
						{item.text}
					</ContextMenuSubTrigger>
					<ContextMenuSubContent>
						<NoteContextMenuItems items={item.items} />
					</ContextMenuSubContent>
				</ContextMenuSub>
			)
		}

		const shortcut = getShortcut(item.accelerator)
		return (
			<ContextMenuItem
				key={item.id}
				disabled={item.enabled === false}
				variant={item.destructive ? "destructive" : "default"}
				onSelect={() => void item.action?.()}
			>
				{getMenuIcon(item.id)}
				{item.text}
				{shortcut && <ContextMenuShortcut>{shortcut}</ContextMenuShortcut>}
			</ContextMenuItem>
		)
	})
}
