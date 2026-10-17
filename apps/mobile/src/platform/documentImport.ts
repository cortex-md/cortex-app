import type { Platform } from "@cortex/platform"

import { CortexNative } from "../../modules/cortex-native"
import { resolveActualFileUri } from "./fileUri"
import { unsupportedPhase1 } from "./unsupported"

export const documentImportApi = {
	extractPdfText: async ({ path }) => {
		if (!CortexNative) return unsupportedPhase1("documentImport.extractPdfText")
		const pages = await CortexNative.extractPdfText(await resolveActualFileUri(path))
		return { pages: pages.map((text, index) => ({ pageNumber: index + 1, text })) }
	},
} satisfies Platform["documentImport"]
