import {
	type SearchHighlightState,
	setSearchHighlight,
	stepSearchHighlight,
} from "@cortex/editor/search-commands"
import type { EditorRuntimeView } from "@cortex/editor/types"
import { useSearchStore } from "@cortex/search"
import { Button } from "@cortex/ui"
import { ChevronDownIcon, ChevronUpIcon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"

const VIEW_READY_ATTEMPTS = 60

interface NoteFindBarProps {
	filePath: string
	getEditorView: () => EditorRuntimeView | null
}

export function NoteFindBar({ filePath, getEditorView }: NoteFindBarProps) {
	const highlight = useSearchStore((state) =>
		state.noteHighlight?.filePath === filePath ? state.noteHighlight : null,
	)
	const [matchState, setMatchState] = useState<SearchHighlightState | null>(null)

	useEffect(() => {
		let frame = 0
		let attempts = 0
		let cancelled = false
		const apply = () => {
			const view = getEditorView()
			if (!view) {
				if (attempts++ < VIEW_READY_ATTEMPTS) frame = requestAnimationFrame(apply)
				return
			}
			void setSearchHighlight(view, highlight?.query ?? null, highlight?.matchIndex ?? 0).then(
				(state) => {
					if (!cancelled) setMatchState(highlight ? state : null)
				},
			)
		}
		apply()
		return () => {
			cancelled = true
			cancelAnimationFrame(frame)
		}
	}, [getEditorView, highlight])

	if (!highlight || !matchState || matchState.total === 0) return null

	const step = (direction: -1 | 1) => {
		const view = getEditorView()
		if (view) void stepSearchHighlight(view, direction).then(setMatchState)
	}

	return (
		<div className="note-find-bar">
			<output className="note-find-bar-inner">
				<span>
					<b>
						{matchState.index + 1} of {matchState.total}
					</b>{" "}
					matches for “{highlight.query}” in this note
				</span>
				<span className="flex-1" />
				<Button variant="ghost" size="icon-xs" aria-label="Previous match" onClick={() => step(-1)}>
					<ChevronUpIcon />
				</Button>
				<Button variant="ghost" size="icon-xs" aria-label="Next match" onClick={() => step(1)}>
					<ChevronDownIcon />
				</Button>
				<Button
					variant="ghost"
					size="icon-xs"
					aria-label="Close search highlight"
					onClick={() => useSearchStore.getState().setNoteHighlight(null)}
				>
					<XIcon />
				</Button>
			</output>
		</div>
	)
}
