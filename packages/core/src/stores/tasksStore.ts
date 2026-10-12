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

const TASK_INDEX_VERSION = 2
const TASK_INDEX_READ_CONCURRENCY = 4
const TASK_INDEX_SERIALIZE_DELAY_MS = 5000

interface PersistedTaskFile extends FileFingerprint {
	tasks: Task[]
}

interface PersistedTaskIndex {
	version: typeof TASK_INDEX_VERSION
	files: Record<string, PersistedTaskFile>
}

let serializeTimer: ReturnType<typeof setTimeout> | null = null
let indexGeneration = 0
let indexedVaultPath: string | null = null
let indexedFiles = new Map<string, PersistedTaskFile>()

function isPersistedTaskIndex(value: unknown): value is PersistedTaskIndex {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as PersistedTaskIndex).version === TASK_INDEX_VERSION &&
		typeof (value as PersistedTaskIndex).files === "object"
	)
}

async function loadPersistedTaskIndex(vaultPath: string): Promise<Map<string, PersistedTaskFile>> {
	try {
		const raw = await getPlatform().fs.readFile(getVaultFilePath(vaultPath, VAULT_FILES.taskIndex))
		const parsed = JSON.parse(raw) as unknown
		if (!isPersistedTaskIndex(parsed)) return new Map()
		return new Map(
			Object.entries(parsed.files).filter(
				([, entry]) =>
					typeof entry?.mtime === "number" &&
					typeof entry.size === "number" &&
					Array.isArray(entry.tasks),
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
		const persisted: PersistedTaskIndex = {
			version: TASK_INDEX_VERSION,
			files: Object.fromEntries(indexedFiles),
		}
		void getPlatform()
			.fs.writeFile(getVaultFilePath(vaultPath, VAULT_FILES.taskIndex), JSON.stringify(persisted))
			.catch(() => {})
	}, TASK_INDEX_SERIALIZE_DELAY_MS)
}

function toTasksByPath(files: ReadonlyMap<string, PersistedTaskFile>): Record<string, Task[]> {
	const tasksByPath: Record<string, Task[]> = {}
	for (const [filePath, file] of files) {
		if (file.tasks.length > 0) tasksByPath[filePath] = file.tasks
	}
	return tasksByPath
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

				buildIndexFromFiles: async (vaultPath, files) => {
					const generation = ++indexGeneration
					const cachedFiles =
						indexedVaultPath === vaultPath ? indexedFiles : await loadPersistedTaskIndex(vaultPath)
					const nextFiles = new Map<string, PersistedTaskFile>()
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
					const inboxPath = getVaultFilePath(vaultPath, VAULT_FILES.taskInbox)
					const [readFiles, inboxTasks] = await Promise.all([
						mapWithConcurrency(changedFiles, TASK_INDEX_READ_CONCURRENCY, async (file) => {
							try {
								const content = await getPlatform().fs.readFile(file.path)
								return { file, tasks: parseTasks(file.path, content) }
							} catch {
								return null
							}
						}),
						readInboxTasks(inboxPath),
					])
					if (generation !== indexGeneration) return
					for (const readFile of readFiles) {
						if (!readFile) continue
						nextFiles.set(readFile.file.path, {
							...getFileEntryFingerprint(readFile.file),
							tasks: readFile.tasks,
						})
					}
					indexedVaultPath = vaultPath
					indexedFiles = nextFiles
					const tasksByPath = toTasksByPath(nextFiles)
					if (inboxTasks.length > 0) tasksByPath[inboxPath] = inboxTasks
					set({ tasksByPath, inboxPath })
					if (changedFiles.length > 0 || cachedFiles.size !== nextFiles.size) {
						scheduleSerialize(vaultPath)
					}
				},

				updateFileInIndex: (filePath, rawContent, fingerprint) => {
					const tasks = parseTasks(filePath, rawContent)
					const { tasksByPath, inboxPath } = get()
					if (tasks.length > 0 || tasksByPath[filePath]) {
						const nextTasksByPath = { ...tasksByPath }
						if (tasks.length > 0) nextTasksByPath[filePath] = tasks
						else delete nextTasksByPath[filePath]
						set({ tasksByPath: nextTasksByPath })
					}
					if (!indexedVaultPath || filePath === inboxPath) return
					const previous = indexedFiles.get(filePath)
					indexedFiles.set(filePath, {
						...(fingerprint ?? { mtime: previous?.mtime ?? 0, size: previous?.size ?? 0 }),
						tasks,
					})
					scheduleSerialize(indexedVaultPath)
				},

				removeFileFromIndex: (filePath) => {
					const { tasksByPath } = get()
					const removedPaths = [...indexedFiles.keys()].filter((path) =>
						isPathOrDescendant(path, filePath),
					)
					if (removedPaths.length === 0) return
					const nextTasksByPath = { ...tasksByPath }
					for (const path of removedPaths) {
						delete nextTasksByPath[path]
						indexedFiles.delete(path)
					}
					set({ tasksByPath: nextTasksByPath })
					if (indexedVaultPath) scheduleSerialize(indexedVaultPath)
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
					indexGeneration++
				},

				reset: () => {
					indexGeneration++
					if (serializeTimer) clearTimeout(serializeTimer)
					serializeTimer = null
					indexedVaultPath = null
					indexedFiles = new Map()
					set({ tasksByPath: {}, inboxPath: null })
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
