import { type FileKind, getFileKind, useDatabaseStore } from "@cortex/core"
import type { DatabaseViewType } from "@cortex/properties/database"
import {
	CalendarIcon,
	FileIcon,
	FileTextIcon,
	FileTypeIcon,
	ImageIcon,
	KanbanIcon,
	LayoutGridIcon,
	type LucideIcon,
	Table2Icon,
} from "lucide-react"

const FILE_KIND_ICONS: Record<FileKind, LucideIcon> = {
	note: FileTextIcon,
	pdf: FileTypeIcon,
	image: ImageIcon,
	other: FileIcon,
}

const DATABASE_VIEW_ICONS: Record<DatabaseViewType, LucideIcon> = {
	table: Table2Icon,
	board: KanbanIcon,
	calendar: CalendarIcon,
	gallery: LayoutGridIcon,
}

export function getFileKindIcon(path: string): LucideIcon {
	return FILE_KIND_ICONS[getFileKind(path)]
}

export function getDatabaseViewIcon(type: DatabaseViewType | undefined): LucideIcon {
	return type ? DATABASE_VIEW_ICONS[type] : Table2Icon
}

export function useDatabaseFirstViewType(folderPath: string): DatabaseViewType | undefined {
	return useDatabaseStore((state) => state.databases[folderPath]?.config.views[0]?.type)
}

export function DatabaseViewTile({ folderPath, size = 20 }: { folderPath: string; size?: number }) {
	const Icon = getDatabaseViewIcon(useDatabaseFirstViewType(folderPath))
	return (
		<span className="database-view-tile" style={{ width: size, height: size }} aria-hidden="true">
			<Icon size={Math.round(size * 0.6)} strokeWidth={2.2} />
		</span>
	)
}
