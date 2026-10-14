import type { ObsidianImportTarget } from "@cortex/import-export"
import { createModalStore } from "@/utils/createModalStore"

export type { ObsidianImportTarget }

export const obsidianImportModal = createModalStore<ObsidianImportTarget>()
