import { requireOptionalNativeModule } from "expo"

export interface ResolvedBookmark {
	uri: string
	stale: boolean
}

interface CortexNativeModule {
	createBookmark(uri: string): string | null
	resolveBookmark(bookmark: string): ResolvedBookmark | null
	takePersistablePermission(uri: string): boolean
	extractPdfText(uri: string): Promise<string[]>
	aes256GcmSeal(key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array): Uint8Array
	aes256GcmOpen(
		key: Uint8Array,
		nonce: Uint8Array,
		ciphertext: Uint8Array,
		tag: Uint8Array,
	): Uint8Array
	hkdfSha256(ikm: Uint8Array, salt: Uint8Array, info: string, length: number): Uint8Array
	x25519PublicKey(privateKey: Uint8Array): Uint8Array
	x25519SharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array
	sha256(data: Uint8Array): Uint8Array
	argon2id(
		password: string,
		salt: Uint8Array,
		memoryCost: number,
		timeCost: number,
		parallelism: number,
		hashLength: number,
	): Promise<Uint8Array>
}

export const CortexNative = requireOptionalNativeModule<CortexNativeModule>("CortexNative")
