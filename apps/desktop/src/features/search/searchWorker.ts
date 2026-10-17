import { createLocalSearchBackend } from "@cortex/search/backend"
import type { SearchWorkerRequest, SearchWorkerResponse } from "./searchWorkerProtocol"

interface SearchWorkerScope {
	onmessage: ((event: MessageEvent<SearchWorkerRequest>) => void) | null
	postMessage(message: SearchWorkerResponse): void
}

const scope = self as unknown as SearchWorkerScope
const backend = createLocalSearchBackend()

scope.onmessage = (event) => {
	const { id, method, args } = event.data
	const call = backend[method] as (...callArgs: unknown[]) => Promise<unknown>
	call(...args).then(
		(result) => scope.postMessage({ id, ok: true, result }),
		(error: unknown) => scope.postMessage({ id, ok: false, error: String(error) }),
	)
}
