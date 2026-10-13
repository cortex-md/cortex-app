import { noteCache } from "@cortex/core"
import { projectRawNote } from "@cortex/properties"
import { useEffect, useState } from "react"

const HIDDEN_KEYS = new Set(["database"])

interface CountState {
	filePath: string | null
	count: number
}

function countProperties(content: string): number {
	return Object.keys(projectRawNote(content).meta).filter((key) => !HIDDEN_KEYS.has(key)).length
}

export function useNotePropertyCount(filePath: string | null): number {
	const [state, setState] = useState<CountState>({ filePath: null, count: 0 })

	useEffect(() => {
		if (!filePath) return
		let cancelled = false
		const apply = (content: string) => {
			if (!cancelled) setState({ filePath, count: countProperties(content) })
		}
		void noteCache.read(filePath).then(apply, () => apply(""))
		const unsubscribe = noteCache.onContentChange(filePath, (_path, content) => apply(content))
		return () => {
			cancelled = true
			unsubscribe()
		}
	}, [filePath])

	return state.filePath === filePath ? state.count : 0
}
