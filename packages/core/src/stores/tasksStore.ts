import { type FileEntry, getPlatform } from "@cortex/platform"
import type { FileFingerprint } from "@cortex/platform/utils"
import {
	applyTaskPatch,
	createTaskLine,
	getTaskIdPath,
	locateTaskLine,
	parseTasks,
	snoozeTaskLine,
	type Task,
	type TaskFields,
	type TaskPatch,
	type TaskRef,
	toggleTaskLine,
	toIsoDate,
} from "@cortex/tasks"
import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { noteMetadataIndex } from "../indexing/noteMetadataIndex"
import { mutateNote } from "../notes/mutateNote"
import { assertVaultPathWritable } from "./accessStore"

export interface TaskLineEdit {
	path: string
	line: number
	previous: string
	next: string
	nextDue?: string
}

export interface TasksState {
	tasksByPath: Record<string, Task[]>
	inboxPath: string | null

	buildIndexFromFiles: (vaultPath: string, files: FileEntry[]) => Promise<void>
	updateFileInIndex: (filePath: string, rawContent: string, fingerprint?: FileFingerprint) => void
	removeFileFromIndex: (filePath: string) => void
	reloadInbox: () => Promise<void>
	cancelIndexing: () => void
	reset: () => void

	toggleTask: (task: TaskRef) => Promise<TaskLineEdit | null>
	updateTask: (task: TaskRef, patch: TaskPatch) => Promise<TaskLineEdit | null>
	snoozeTask: (task: TaskRef, until: Date) => Promise<TaskLineEdit | null>
	transformTask: (
		task: TaskRef,
		transform: (line: string) => string,
	) => Promise<TaskLineEdit | null>
	revertTaskEdit: (edit: TaskLineEdit) => Promise<void>
	addTask: (fields: TaskFields) => Promise<TaskLineEdit | null>
}

async function readInboxTasks(inboxPath: string): Promise<Task[]> {
	try {
		return parseTasks(inboxPath, await getPlatform().fs.readFile(inboxPath))
	} catch {
		return []
	}
}

export const useTasksStore = create<TasksState>()(
	devtools(
		(set, get) => {
			const rewriteTaskLine = async (
				ref: TaskRef,
				transform: (line: string) => { line: string; nextDue?: string },
			): Promise<TaskLineEdit | null> => {
				assertVaultPathWritable(ref.path)
				let edit: TaskLineEdit | null = null
				const mutation = await mutateNote(ref.path, (content) => {
					edit = null
					const lineBreak = content.includes("\r\n") ? "\r\n" : "\n"
					const lines = content.split(/\r?\n/)
					const index = locateTaskLine(lines, ref)
					const previous = lines[index]
					if (previous === undefined) return content
					const result = transform(previous)
					if (result.line === previous) return content
					lines[index] = result.line
					edit = {
						path: ref.path,
						line: index,
						previous,
						next: result.line,
						nextDue: result.nextDue,
					}
					return lines.join(lineBreak)
				})
				if (!mutation) return null
				get().updateFileInIndex(ref.path, mutation.next)
				return edit
			}

			return {
				tasksByPath: {},
				inboxPath: null,

				buildIndexFromFiles: (vaultPath, files) => noteMetadataIndex.build(vaultPath, files),

				updateFileInIndex: (filePath, rawContent, fingerprint) => {
					noteMetadataIndex.update(filePath, rawContent, fingerprint)
				},

				removeFileFromIndex: (filePath) => {
					noteMetadataIndex.remove(filePath)
				},

				reloadInbox: async () => {
					const { inboxPath } = get()
					if (!inboxPath) return
					const tasks = await readInboxTasks(inboxPath)
					if (get().inboxPath !== inboxPath) return
					const nextTasksByPath = { ...get().tasksByPath }
					if (tasks.length > 0) nextTasksByPath[inboxPath] = tasks
					else delete nextTasksByPath[inboxPath]
					set({ tasksByPath: nextTasksByPath })
				},

				cancelIndexing: () => {
					noteMetadataIndex.cancel()
				},

				reset: () => {
					noteMetadataIndex.reset()
				},

				toggleTask: (task) =>
					rewriteTaskLine(task, (line) => toggleTaskLine(line, toIsoDate(new Date()))),

				updateTask: (task, patch) =>
					rewriteTaskLine(task, (line) => ({ line: applyTaskPatch(line, patch) })),

				snoozeTask: (task, until) =>
					rewriteTaskLine(task, (line) => ({ line: snoozeTaskLine(line, until) })),

				transformTask: (task, transform) =>
					rewriteTaskLine(task, (line) => ({ line: transform(line) })),

				revertTaskEdit: async (edit) => {
					await rewriteTaskLine({ path: edit.path, line: edit.line, raw: edit.next }, () => ({
						line: edit.previous,
					}))
				},

				addTask: async (fields) => {
					const { inboxPath } = get()
					if (!inboxPath || !fields.title.trim()) return null
					const line = createTaskLine(fields)
					let lineIndex = 0
					const mutation = await mutateNote(
						inboxPath,
						(content) => {
							const prefix =
								content.length === 0 || content.endsWith("\n") ? content : `${content}\n`
							lineIndex = prefix.split("\n").length - 1
							return `${prefix}${line}\n`
						},
						{ allowMissing: true },
					)
					if (!mutation) return null
					get().updateFileInIndex(inboxPath, mutation.next)
					return { path: inboxPath, line: lineIndex, previous: "", next: line }
				},
			}
		},
		{ name: "tasksStore" },
	),
)

const taskListCache = new WeakMap<Record<string, Task[]>, Task[]>()

export function selectAllTasks(state: Pick<TasksState, "tasksByPath">): Task[] {
	const cached = taskListCache.get(state.tasksByPath)
	if (cached) return cached
	const tasks = Object.values(state.tasksByPath).flat()
	taskListCache.set(state.tasksByPath, tasks)
	return tasks
}

export function findTaskById(state: Pick<TasksState, "tasksByPath">, id: string): Task | undefined {
	return state.tasksByPath[getTaskIdPath(id)]?.find((task) => task.id === id)
}
