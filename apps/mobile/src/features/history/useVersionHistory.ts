import { useCallback, useEffect, useState } from "react"

import { loadVersionHistory, type VersionHistory } from "@/features/history/versionHistoryAdapter"

export function useVersionHistory(filePath: string | null): {
	history: VersionHistory | null
	reload: () => void
} {
	const [history, setHistory] = useState<VersionHistory | null>(null)
	const [revision, setRevision] = useState(0)

	useEffect(() => {
		let cancelled = false
		void loadVersionHistory(filePath).then((loaded) => {
			if (!cancelled) setHistory(loaded)
		})
		return () => {
			cancelled = true
		}
	}, [filePath, revision])

	const reload = useCallback(() => setRevision((value) => value + 1), [])
	return { history, reload }
}

export function readParam(value: string | string[] | undefined): string | null {
	const resolved = Array.isArray(value) ? value[0] : value
	return resolved ? resolved : null
}
