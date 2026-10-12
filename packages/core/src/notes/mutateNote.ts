import { getPlatform } from "@cortex/platform"
import { noteCache } from "../noteCache"
import { pathExists } from "../utils/createdNote"

export interface NoteMutation {
	previous: string
	next: string
}

const mutationQueues = new Map<string, Promise<unknown>>()

function enqueue<T>(path: string, task: () => Promise<T>): Promise<T> {
	const previous = mutationQueues.get(path) ?? Promise.resolve()
	const next = previous.catch(() => undefined).then(task)
	mutationQueues.set(path, next)
	void next.finally(() => {
		if (mutationQueues.get(path) === next) mutationQueues.delete(path)
	})
	return next
}

async function readNote(path: string, allowMissing: boolean): Promise<string> {
	const entry = noteCache.getEntry(path)
	if (entry) return entry.content
	try {
		return await getPlatform().fs.readFile(path)
	} catch (error) {
		if (allowMissing && !(await pathExists(path))) return ""
		throw error
	}
}

export function mutateNote(
	path: string,
	transform: (content: string) => string,
	options: { allowMissing?: boolean } = {},
): Promise<NoteMutation | null> {
	return enqueue(path, async () => {
		const previous = await readNote(path, options.allowMissing ?? false)
		const next = transform(previous)
		if (next === previous) return null
		if (noteCache.getEntry(path)) noteCache.writeExternal(path, next)
		else await getPlatform().fs.atomicWriteFile(path, next)
		return { previous, next }
	})
}
