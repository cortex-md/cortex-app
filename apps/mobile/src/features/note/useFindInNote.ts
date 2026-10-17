import { useRef, useState } from "react"

import { workspaceChannel } from "@/features/workspace/workspaceChannel"
import type { WorkspaceFindResult } from "@/features/workspace/workspaceProtocol"

const EMPTY_RESULT: WorkspaceFindResult = { current: 0, total: 0 }

export function useFindInNote() {
	const [open, setOpen] = useState(false)
	const [query, setQueryState] = useState("")
	const [result, setResult] = useState<WorkspaceFindResult>(EMPTY_RESULT)
	const requestRef = useRef(0)

	function track(promise: Promise<WorkspaceFindResult>) {
		const request = ++requestRef.current
		void promise.then(
			(next) => {
				if (request === requestRef.current) setResult(next)
			},
			() => {
				if (request === requestRef.current) setResult(EMPTY_RESULT)
			},
		)
	}

	function setQuery(next: string) {
		setQueryState(next)
		track(workspaceChannel.find(next))
	}

	function step(direction: "next" | "prev") {
		if (!query) return
		track(workspaceChannel.find(query, direction))
	}

	function show() {
		setOpen(true)
	}

	function close() {
		setOpen(false)
		setQueryState("")
		setResult(EMPTY_RESULT)
		track(workspaceChannel.find(""))
	}

	return { close, open, query, result, setQuery, show, step }
}

export type FindInNote = ReturnType<typeof useFindInNote>
