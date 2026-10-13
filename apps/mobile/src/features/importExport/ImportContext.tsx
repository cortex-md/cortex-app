import { createContext, type ReactNode, use } from "react"

import { type ImportSheetController, useImportSheet } from "@/features/importExport/useImportSheet"

const ImportContext = createContext<ImportSheetController | null>(null)

export function ImportProvider({ children }: { children: ReactNode }) {
	const controller = useImportSheet()
	return <ImportContext value={controller}>{children}</ImportContext>
}

export function useImport(): ImportSheetController {
	const controller = use(ImportContext)
	if (!controller) throw new Error("useImport must be used inside ImportProvider")
	return controller
}
