import { type FileEntry, getPlatform } from "@cortex/platform"
import {
	type FileFingerprint,
	getFileEntryFingerprint,
	getVaultFilePath,
	hasSameFingerprint,
	isMarkdownPath,
	isPathOrDescendant,
	mapWithConcurrency,
	VAULT_FILES,
} from "@cortex/platform/utils"
import { extractFrontmatterBody } from "@cortex/properties"
import { extractWikiLinks, type WikiLink } from "@cortex/search"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
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

const LINK_INDEX_VERSION = 1
const LINK_INDEX_READ_CONCURRENCY = 4
const LINK_INDEX_SERIALIZE_DELAY_MS = 5000

interface PersistedLinkFile extends FileFingerprint {
	links: WikiLink[]
}

interface PersistedLinkIndex {
	version: typeof LINK_INDEX_VERSION
	files: Record<string, PersistedLinkFile>
}

let serializeTimer: ReturnType<typeof setTimeout> | null = null
let indexGeneration = 0
let indexedVaultPath: string | null = null
let indexedFiles = new Map<string, PersistedLinkFile>()

function extractNoteLinks(rawContent: string): WikiLink[] {
	return extractWikiLinks(extractFrontmatterBody(rawContent))
}

function isPersistedLinkIndex(value: unknown): value is PersistedLinkIndex {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as PersistedLinkIndex).version === LINK_INDEX_VERSION &&
		typeof (value as PersistedLinkIndex).files === "object"
	)
}

async function loadPersistedLinkIndex(vaultPath: string): Promise<Map<string, PersistedLinkFile>> {
	try {
		const raw = await getPlatform().fs.readFile(getVaultFilePath(vaultPath, VAULT_FILES.linkIndex))
		const parsed = JSON.parse(raw) as unknown
		if (!isPersistedLinkIndex(parsed)) return new Map()
		return new Map(
			Object.entries(parsed.files).filter(
				([, entry]) =>
					typeof entry?.mtime === "number" &&
					typeof entry.size === "number" &&
					Array.isArray(entry.links),
			),
		)
	} catch {
		return new Map()
	}
}

function scheduleSerialize(vaultPath: string): void {
	if (serializeTimer) clearTimeout(serializeTimer)
	serializeTimer = setTimeout(() => {
		serializeTimer = null
		if (indexedVaultPath !== vaultPath) return
		const persisted: PersistedLinkIndex = {
			version: LINK_INDEX_VERSION,
			files: Object.fromEntries(indexedFiles),
		}
		void getPlatform()
			.fs.writeFile(getVaultFilePath(vaultPath, VAULT_FILES.linkIndex), JSON.stringify(persisted))
			.catch(() => {})
	}, LINK_INDEX_SERIALIZE_DELAY_MS)
}

function toOutgoing(files: ReadonlyMap<string, PersistedLinkFile>): Record<string, WikiLink[]> {
	const outgoing: Record<string, WikiLink[]> = {}
	for (const [filePath, file] of files) {
		if (file.links.length > 0) outgoing[filePath] = file.links
	}
	return outgoing
}

export const useLinksStore = create<LinksState>()(
	devtools(
		(set, get) => ({
			outgoing: {},

			buildIndexFromFiles: async (vaultPath, files) => {
				const generation = ++indexGeneration
				const cachedFiles =
					indexedVaultPath === vaultPath ? indexedFiles : await loadPersistedLinkIndex(vaultPath)
				const nextFiles = new Map<string, PersistedLinkFile>()
				const changedFiles: FileEntry[] = []
				for (const file of files) {
					if (file.isDir || !isMarkdownPath(file.path)) continue
					const cached = cachedFiles.get(file.path)
					if (cached && hasSameFingerprint(cached, getFileEntryFingerprint(file))) {
						nextFiles.set(file.path, cached)
					} else {
						changedFiles.push(file)
					}
				}
				const readFiles = await mapWithConcurrency(
					changedFiles,
					LINK_INDEX_READ_CONCURRENCY,
					async (file) => {
						try {
							const content = await getPlatform().fs.readFile(file.path)
							return { file, links: extractNoteLinks(content) }
						} catch {
							return null
						}
					},
				)
				if (generation !== indexGeneration) return
				for (const readFile of readFiles) {
					if (!readFile) continue
					nextFiles.set(readFile.file.path, {
						...getFileEntryFingerprint(readFile.file),
						links: readFile.links,
					})
				}
				indexedVaultPath = vaultPath
				indexedFiles = nextFiles
				set({ outgoing: toOutgoing(nextFiles) })
				if (changedFiles.length > 0 || cachedFiles.size !== nextFiles.size) {
					scheduleSerialize(vaultPath)
				}
			},

			updateFileInIndex: (filePath, rawContent, fingerprint) => {
				const links = extractNoteLinks(rawContent)
				const { outgoing } = get()
				if (links.length > 0 || outgoing[filePath]) {
					const nextOutgoing = { ...outgoing }
					if (links.length > 0) nextOutgoing[filePath] = links
					else delete nextOutgoing[filePath]
					set({ outgoing: nextOutgoing })
				}
				if (!indexedVaultPath) return
				const previous = indexedFiles.get(filePath)
				indexedFiles.set(filePath, {
					...(fingerprint ?? { mtime: previous?.mtime ?? 0, size: previous?.size ?? 0 }),
					links,
				})
				scheduleSerialize(indexedVaultPath)
			},

			removeFileFromIndex: (filePath) => {
				const { outgoing } = get()
				const removedPaths = [...indexedFiles.keys()].filter((path) =>
					isPathOrDescendant(path, filePath),
				)
				if (removedPaths.length === 0) return
				const nextOutgoing = { ...outgoing }
				for (const path of removedPaths) {
					delete nextOutgoing[path]
					indexedFiles.delete(path)
				}
				set({ outgoing: nextOutgoing })
				if (indexedVaultPath) scheduleSerialize(indexedVaultPath)
			},

			cancelIndexing: () => {
				indexGeneration++
			},

			reset: () => {
				indexGeneration++
				if (serializeTimer) clearTimeout(serializeTimer)
				serializeTimer = null
				indexedVaultPath = null
				indexedFiles = new Map()
				set({ outgoing: {} })
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
