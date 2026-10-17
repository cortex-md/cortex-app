import {
	getNoteTitle,
	getParentPath,
	getRecentFilePaths,
	joinPath,
	toVaultRelativePath,
	useTagsStore,
	useVaultModifiedTimes,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { type SearchResult, type SearchSnippet, useSearchStore } from "@cortex/search"
import { useEffect, useMemo, useRef, useState } from "react"

export type QuickFinderSort = "best" | "recent"

export interface QuickFinderItem {
	id: string
	filePath: string
	title: string
	folder: string
	snippet: SearchSnippet | null
	modifiedAt: number | null
}

export interface QuickFinderFilters {
	folder: string | null
	tags: readonly string[]
	titleOnly: boolean
	sort: QuickFinderSort
}

interface SearchBatch {
	query: string
	results: SearchResult[]
}

const RESULT_LIMIT = 20
const CONTENT_SEARCH_DELAY_MS = 120
const MIN_CONTENT_QUERY_LENGTH = 3
const EMPTY_BATCH: SearchBatch = { query: "", results: [] }

function folderFromRelative(relativePath: string): string {
	return getParentPath(relativePath)
}

function isInFolder(folder: string | null, relativeFolder: string): boolean {
	if (!folder) return true
	return relativeFolder === folder || relativeFolder.startsWith(`${folder}/`)
}

export function useQuickFinderResults(
	query: string,
	filters: QuickFinderFilters,
): { items: QuickFinderItem[]; pending: boolean } {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? "")
	const modifiedTimes = useVaultModifiedTimes()
	const panes = useWorkspaceStore((state) => state.panes)
	const recentlyClosed = useWorkspaceStore((state) => state.recentlyClosed)
	const tagIndex = useTagsStore((state) => state.tagIndex)
	const indexing = useSearchStore((state) => state.indexing)
	const [titleBatch, setTitleBatch] = useState(EMPTY_BATCH)
	const [contentBatch, setContentBatch] = useState(EMPTY_BATCH)
	const latestQueryRef = useRef("")
	const trimmed = query.trim()

	useEffect(() => {
		latestQueryRef.current = trimmed
		if (!trimmed || indexing) return
		void useSearchStore
			.getState()
			.searchTitles(trimmed)
			.then((results) => {
				if (latestQueryRef.current === trimmed) setTitleBatch({ query: trimmed, results })
			})
		if (filters.titleOnly || trimmed.length < MIN_CONTENT_QUERY_LENGTH) return
		const timer = setTimeout(() => {
			const { findNotes, loadMatches } = useSearchStore.getState()
			void findNotes(trimmed, {
				folders: filters.folder ? [filters.folder] : undefined,
				limit: RESULT_LIMIT,
			}).then(async (results) => {
				if (latestQueryRef.current !== trimmed) return
				const withMatches = await loadMatches(results, trimmed)
				if (latestQueryRef.current === trimmed) {
					setContentBatch({ query: trimmed, results: withMatches })
				}
			})
		}, CONTENT_SEARCH_DELAY_MS)
		return () => clearTimeout(timer)
	}, [filters.folder, filters.titleOnly, indexing, trimmed])

	const allowedByTags = useMemo(() => {
		if (filters.tags.length === 0) return null
		const allowed = new Set<string>()
		for (const tag of filters.tags) {
			for (const [candidate, paths] of Object.entries(tagIndex)) {
				if (candidate === tag || candidate.startsWith(`${tag}/`)) {
					for (const path of paths) allowed.add(path)
				}
			}
		}
		return allowed
	}, [filters.tags, tagIndex])

	const items = useMemo(() => {
		const keep = (filePath: string, folder: string) =>
			isInFolder(filters.folder, folder) && (!allowedByTags || allowedByTags.has(filePath))
		let list: QuickFinderItem[]
		if (!trimmed) {
			list = getRecentFilePaths(panes, recentlyClosed).flatMap((filePath) => {
				const relative = toVaultRelativePath(filePath, vaultPath) ?? filePath
				const folder = folderFromRelative(relative)
				if (!keep(filePath, folder)) return []
				return [
					{
						id: relative,
						filePath,
						title: getNoteTitle(filePath),
						folder,
						snippet: null,
						modifiedAt: modifiedTimes.get(filePath) ?? null,
					},
				]
			})
		} else {
			const titles = titleBatch.query === trimmed ? titleBatch.results : []
			const contents =
				contentBatch.query === trimmed && !filters.titleOnly
					? contentBatch.results.filter((result) => result.snippets.length > 0)
					: []
			const seen = new Set<string>()
			list = []
			for (const result of [...titles, ...contents]) {
				if (seen.has(result.id)) continue
				seen.add(result.id)
				const filePath = joinPath(vaultPath, result.id)
				if (!keep(filePath, result.folder)) continue
				list.push({
					id: result.id,
					filePath,
					title: result.title,
					folder: result.folder,
					snippet: result.snippets[0] ?? null,
					modifiedAt: modifiedTimes.get(filePath) ?? null,
				})
			}
		}
		if (filters.sort === "recent") {
			list = [...list].sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0))
		}
		return list.slice(0, RESULT_LIMIT)
	}, [
		allowedByTags,
		contentBatch,
		filters.folder,
		filters.sort,
		filters.titleOnly,
		modifiedTimes,
		panes,
		recentlyClosed,
		titleBatch,
		trimmed,
		vaultPath,
	])

	return { items, pending: Boolean(trimmed) && titleBatch.query !== trimmed }
}
