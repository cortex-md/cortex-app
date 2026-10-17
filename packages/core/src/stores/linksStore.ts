import type { FileEntry } from "@cortex/platform"
import type { FileFingerprint } from "@cortex/platform/utils"
import type { WikiLink } from "@cortex/search"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { noteMetadataIndex } from "../indexing/noteMetadataIndex"
import type { WikiLinkResolver } from "../utils/links"

export interface Backlink {
	sourcePath: string
	links: WikiLink[]
}

export interface LinksState {
	outgoing: Record<string, WikiLink[]>

	buildIndexFromFiles: (vaultPath: string, files: FileEntry[]) => Promise<void>
	updateFileInIndex: (filePath: string, rawContent: string, fingerprint?: FileFingerprint) => void
	removeFileFromIndex: (filePath: string) => void
	cancelIndexing: () => void
	reset: () => void
}

export const useLinksStore = create<LinksState>()(
	devtools(
		() => ({
			outgoing: {},

			buildIndexFromFiles: (vaultPath, files) => noteMetadataIndex.build(vaultPath, files),

			updateFileInIndex: (filePath, rawContent, fingerprint) => {
				noteMetadataIndex.update(filePath, rawContent, fingerprint)
			},

			removeFileFromIndex: (filePath) => {
				noteMetadataIndex.remove(filePath)
			},

			cancelIndexing: () => {
				noteMetadataIndex.cancel()
			},

			reset: () => {
				noteMetadataIndex.reset()
			},
		}),
		{ name: "linksStore" },
	),
)

export function selectBacklinks(
	outgoing: Readonly<Record<string, WikiLink[]>>,
	targetPath: string,
	resolve: WikiLinkResolver,
): Backlink[] {
	const backlinks: Backlink[] = []
	for (const [sourcePath, links] of Object.entries(outgoing)) {
		if (sourcePath === targetPath) continue
		const matching = links.filter((link) => resolve(link.target) === targetPath)
		if (matching.length > 0) backlinks.push({ sourcePath, links: matching })
	}
	return backlinks.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath))
}
