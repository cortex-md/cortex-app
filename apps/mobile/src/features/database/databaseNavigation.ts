import { type Href, router } from "expo-router"

import type { ViewOptionsTab } from "@/features/database/databaseFormat"
import { presentSheet } from "@/features/navigation/routes"

export function openDatabaseRow(folderPath: string, filePath: string, viewId?: string): void {
	router.push({ params: { filePath, folderPath, viewId }, pathname: "/database-row" } as Href)
}

export function openDatabaseViewOptions(
	folderPath: string,
	viewId: string | undefined,
	tab: ViewOptionsTab,
): void {
	presentSheet("db-view-options", { folderPath, tab, viewId })
}

export function openNewDatabase(params?: {
	parentPath?: string
	start?: "blank" | "folder"
}): void {
	presentSheet("db-new", params)
}

export function readParam(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value
}
