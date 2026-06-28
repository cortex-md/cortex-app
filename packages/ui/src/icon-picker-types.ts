import type { iconsData } from "./icons-data"

export type IconData = (typeof iconsData)[number]

export interface CategorizedIconGroup {
	name: string
	icons: IconData[]
}

export interface VirtualIconItem {
	type: "category" | "row"
	categoryIndex: number
	rowIndex?: number
	icons?: IconData[]
}

export interface IconPickerPopoverVisibility {
	open: boolean
	version: number
}
