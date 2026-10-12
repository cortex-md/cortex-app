import { blake3 } from "@noble/hashes/blake3"
import { bytesToHex } from "@noble/hashes/utils"

const encoder = new TextEncoder()

export function hashBytes(data: Uint8Array | string): string {
	return bytesToHex(blake3(typeof data === "string" ? encoder.encode(data) : data))
}
