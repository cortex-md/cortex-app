import { requireOptionalNativeModule } from "expo"

export interface ResolvedBookmark {
	uri: string
	stale: boolean
}

interface CortexNativeModule {
	createBookmark(uri: string): string | null
	resolveBookmark(bookmark: string): ResolvedBookmark | null
	takePersistablePermission(uri: string): boolean
	extractPdfText(uri: string): Promise<string[]>
}

export const CortexNative = requireOptionalNativeModule<CortexNativeModule>("CortexNative")
