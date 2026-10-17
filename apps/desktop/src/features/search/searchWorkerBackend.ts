import type { SearchBackend } from "@cortex/search/backend"
import type {
	SearchWorkerMethod,
	SearchWorkerRequest,
	SearchWorkerResponse,
} from "./searchWorkerProtocol"

interface PendingCall {
	resolve: (result: unknown) => void
	reject: (error: Error) => void
}

export function createSearchWorkerBackend(): SearchBackend {
	let worker: Worker | null = null
	let nextId = 0
	const pending = new Map<number, PendingCall>()

	const rejectPending = (error: Error) => {
		for (const call of pending.values()) call.reject(error)
		pending.clear()
	}

	const startWorker = () => {
		const nextWorker = new Worker(new URL("./searchWorker.ts", import.meta.url), {
			type: "module",
			name: "search",
		})
		nextWorker.onmessage = (event: MessageEvent<SearchWorkerResponse>) => {
			const response = event.data
			const call = pending.get(response.id)
			if (!call) return
			pending.delete(response.id)
			if (response.ok) call.resolve(response.result)
			else call.reject(new Error(response.error))
		}
		nextWorker.onerror = (event) => {
			event.preventDefault()
			rejectPending(new Error(event.message || "Search worker failed"))
		}
		return nextWorker
	}

	const call = <Method extends SearchWorkerMethod>(
		method: Method,
		...args: Parameters<SearchBackend[Method]>
	): ReturnType<SearchBackend[Method]> => {
		worker ??= startWorker()
		const id = nextId++
		const request: SearchWorkerRequest = { id, method, args }
		const result = new Promise((resolve, reject) => {
			pending.set(id, { resolve, reject })
		})
		worker.postMessage(request)
		return result as ReturnType<SearchBackend[Method]>
	}

	return {
		load: (persistedIndex) => call("load", persistedIndex),
		planIndex: (entries) => call("planIndex", entries),
		addDocuments: (documents) => call("addDocuments", documents),
		removePaths: (ids) => call("removePaths", ids),
		search: (query, options) => call("search", query, options),
		searchTitles: (query) => call("searchTitles", query),
		matchNotes: (query, notes, options) => call("matchNotes", query, notes, options),
		readNoteExcerpts: (notes, maxLength) => call("readNoteExcerpts", notes, maxLength),
		serialize: () => call("serialize"),
		clear: () => call("clear"),
	}
}
