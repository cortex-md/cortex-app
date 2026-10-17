import {
	computeVersionDeltas,
	VERSION_PREFETCH_CONCURRENCY as PREFETCH_CONCURRENCY,
	VERSION_PREFETCH_LIMIT as PREFETCH_LIMIT,
	type WordChangeCount,
} from "@cortex/core"
import { mapWithConcurrency } from "@cortex/platform/utils"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export interface VersionContents {
	contents: Record<string, string>
	deltas: Record<string, WordChangeCount>
	loadContent: (id: string) => Promise<string>
}

export function useVersionContents<T extends { id: string }>(
	entries: readonly T[] | null,
	loadEntryContent: (entry: T) => Promise<string>,
): VersionContents {
	const [contents, setContents] = useState<Record<string, string>>({})
	const requests = useRef(new Map<string, Promise<string>>())
	const deltaCache = useRef(new Map<string, WordChangeCount>())

	const loadContent = useCallback(
		(id: string): Promise<string> => {
			const pending = requests.current.get(id)
			if (pending) return pending
			const entry = entries?.find((candidate) => candidate.id === id)
			if (!entry) return Promise.reject(new Error("Version not found"))
			const request = loadEntryContent(entry).then((content) => {
				setContents((current) => ({ ...current, [id]: content }))
				return content
			})
			request.catch(() => requests.current.delete(id))
			requests.current.set(id, request)
			return request
		},
		[entries, loadEntryContent],
	)

	useEffect(() => {
		if (!entries || entries.length === 0) return
		const targets = entries.slice(0, PREFETCH_LIMIT + 1)
		void mapWithConcurrency(targets, PREFETCH_CONCURRENCY, (entry) =>
			loadContent(entry.id).catch(() => undefined),
		)
	}, [entries, loadContent])

	const deltas = useMemo(
		() => computeVersionDeltas(entries, contents, deltaCache.current),
		[entries, contents],
	)

	return { contents, deltas, loadContent }
}
