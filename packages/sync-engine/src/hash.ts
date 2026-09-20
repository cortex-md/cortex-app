import { blake3 } from "@noble/hashes/blake3"
import { bytesToHex } from "@noble/hashes/utils"

export function hashContent(data: Buffer | string | Uint8Array): string {
	const bytes =
		typeof data === "string"
			? new TextEncoder().encode(data)
			: data instanceof Uint8Array
				? data
				: new Uint8Array(data)
	return bytesToHex(blake3(bytes))
}
