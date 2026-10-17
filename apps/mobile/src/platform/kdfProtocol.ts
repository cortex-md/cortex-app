import type { DOMImperativeFactory } from "expo/dom"

export interface Argon2Params {
	memoryCost: number
	timeCost: number
	parallelism: number
	hashLength: number
}

export interface KdfRequest extends Argon2Params {
	id: number
	password: string
	salt: number[]
}

export type KdfMessage =
	| { type: "ready" }
	| { type: "result"; id: number; hash: number[] }
	| { type: "error"; id: number; message: string }

export type KdfViewHandle = DOMImperativeFactory & {
	derive(request: KdfRequest): void
}
