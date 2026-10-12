import type { CommandEntry } from "@cortex/commands"
import { createAnchor, sortThreadsByPosition } from "@cortex/comments"
import {
	canWriteVaultPath,
	selectNoteComments,
	useCommentsStore,
	useEditorStore,
	useUIStore,
} from "@cortex/core"
import type { EditorRuntimeView } from "@cortex/editor/types"
import { getEditorViewRef } from "@cortex/plugin-host-core"
import { MessageSquarePlusIcon } from "lucide-react"

export const ADD_COMMENT_COMMAND_ID = "comments.add"

function openCommentsPanel(): void {
	useUIStore.getState().setRightSidebarLayout({ collapsed: false, panel: "comments" })
}

function startCommentFromSelection(): void {
	const view = getEditorViewRef() as EditorRuntimeView | null
	const filePath = useEditorStore.getState().activeFilePath
	if (!view || !filePath || !canWriteVaultPath(filePath)) return
	const selection = view.state.selection.main
	if (selection.empty) {
		openCommentsPanel()
		return
	}
	const anchor = createAnchor(view.state.doc.toString(), selection.from, selection.to)
	if (!anchor.quote.trim()) return
	useCommentsStore.getState().startDraft(filePath, anchor)
	openCommentsPanel()
}

function stepThread(direction: 1 | -1): void {
	const filePath = useEditorStore.getState().activeFilePath
	if (!filePath) return
	const state = useCommentsStore.getState()
	const ranges = state.anchorRanges?.notePath === filePath ? state.anchorRanges.ranges : {}
	const threads = sortThreadsByPosition(
		Object.values(selectNoteComments(state, filePath).threads).filter(
			(thread) => thread.resolvedAt === null && ranges[thread.id],
		),
		new Map(Object.entries(ranges)),
	)
	if (threads.length === 0) return
	const currentIndex = threads.findIndex((thread) => thread.id === state.focusedThreadId)
	const nextIndex =
		currentIndex === -1
			? direction === 1
				? 0
				: threads.length - 1
			: (currentIndex + direction + threads.length) % threads.length
	const next = threads[nextIndex]
	if (!next) return
	openCommentsPanel()
	state.focusThread(next.id, { reveal: true })
}

export const commentCommands: CommandEntry[] = [
	{
		id: ADD_COMMENT_COMMAND_ID,
		label: "Add Comment",
		category: "Comments",
		aliases: ["comment", "annotate"],
		icon: MessageSquarePlusIcon,
		hotkey: { defaultKeys: "mod+alt+m", scope: "editor" },
		execute: startCommentFromSelection,
	},
	{
		id: "comments.next",
		label: "Next Comment",
		category: "Comments",
		execute: () => stepThread(1),
	},
	{
		id: "comments.previous",
		label: "Previous Comment",
		category: "Comments",
		execute: () => stepThread(-1),
	},
	{
		id: "view.comments",
		label: "Show Comments",
		category: "View",
		aliases: ["comments"],
		execute: openCommentsPanel,
	},
]
