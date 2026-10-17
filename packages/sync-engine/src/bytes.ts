const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
const DECODE_TABLE = new Int16Array(128).fill(-1)
for (let index = 0; index < 64; index += 1) {
	DECODE_TABLE[BASE64_ALPHABET.charCodeAt(index)] = index
	DECODE_TABLE[BASE64URL_ALPHABET.charCodeAt(index)] = index
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export function utf8Encode(text: string): Uint8Array {
	return textEncoder.encode(text)
}

export function utf8Decode(bytes: Uint8Array): string {
	return textDecoder.decode(bytes)
}

function encode(bytes: Uint8Array, alphabet: string, pad: boolean): string {
	let output = ""
	let index = 0
	for (; index + 2 < bytes.length; index += 3) {
		const value =
			((bytes[index] ?? 0) << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0)
		output +=
			alphabet[(value >>> 18) & 63] +
			alphabet[(value >>> 12) & 63] +
			alphabet[(value >>> 6) & 63] +
			alphabet[value & 63]
	}
	const remaining = bytes.length - index
	if (remaining === 1) {
		const value = (bytes[index] ?? 0) << 16
		output += alphabet[(value >>> 18) & 63] + alphabet[(value >>> 12) & 63]
		if (pad) output += "=="
	} else if (remaining === 2) {
		const value = ((bytes[index] ?? 0) << 16) | ((bytes[index + 1] ?? 0) << 8)
		output +=
			alphabet[(value >>> 18) & 63] + alphabet[(value >>> 12) & 63] + alphabet[(value >>> 6) & 63]
		if (pad) output += "="
	}
	return output
}

function decode(text: string): Uint8Array {
	const output: number[] = []
	let buffer = 0
	let bits = 0
	for (let index = 0; index < text.length; index += 1) {
		const code = text.charCodeAt(index)
		if (code === 61) break
		const value = code < 128 ? (DECODE_TABLE[code] ?? -1) : -1
		if (value < 0) continue
		buffer = ((buffer << 6) | value) & 0xffffff
		bits += 6
		if (bits >= 8) {
			bits -= 8
			output.push((buffer >>> bits) & 0xff)
		}
	}
	return Uint8Array.from(output)
}

export function toBase64(bytes: Uint8Array): string {
	return encode(bytes, BASE64_ALPHABET, true)
}

export function fromBase64(text: string): Uint8Array {
	return decode(text)
}

export function toBase64Url(bytes: Uint8Array): string {
	return encode(bytes, BASE64URL_ALPHABET, false)
}

export function fromBase64Url(text: string): Uint8Array {
	return decode(text)
}

export function toHex(bytes: Uint8Array): string {
	let output = ""
	for (const byte of bytes) output += byte.toString(16).padStart(2, "0")
	return output
}

export function fromHex(text: string): Uint8Array {
	const output = new Uint8Array(text.length / 2)
	for (let index = 0; index < output.length; index += 1) {
		output[index] = Number.parseInt(text.slice(index * 2, index * 2 + 2), 16)
	}
	return output
}

export function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
	const total = parts.reduce((sum, part) => sum + part.length, 0)
	const output = new Uint8Array(total)
	let offset = 0
	for (const part of parts) {
		output.set(part, offset)
		offset += part.length
	}
	return output
}

export function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
	if (left.length !== right.length) return false
	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) return false
	}
	return true
}
