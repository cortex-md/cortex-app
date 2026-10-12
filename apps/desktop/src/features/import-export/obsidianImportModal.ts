import { createModalStore } from "@/utils/createModalStore"

export type ObsidianImportTarget =
	| { mode: "import"; sourcePath: string; defaultFolder: string }
	| { mode: "adopt" }

export const obsidianImportModal = createModalStore<ObsidianImportTarget>()
