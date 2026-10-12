import type { SearchBackend } from "@cortex/search/backend"

export type SearchWorkerMethod = keyof SearchBackend

export interface SearchWorkerRequest {
	id: number
	method: SearchWorkerMethod
	args: unknown[]
}

export type SearchWorkerResponse =
	| { id: number; ok: true; result: unknown }
	| { id: number; ok: false; error: string }
