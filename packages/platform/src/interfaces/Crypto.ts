export interface X25519KeyPairBytes {
	publicKey: Uint8Array
	privateKey: Uint8Array
}

export interface Argon2idOptions {
	salt: Uint8Array
	memoryCost: number
	timeCost: number
	parallelism: number
	hashLength: number
}

export interface CryptoPrimitives {
	randomBytes(length: number): Uint8Array
	aes256GcmEncrypt(
		key: Uint8Array,
		nonce: Uint8Array,
		plaintext: Uint8Array,
	): { ciphertext: Uint8Array; tag: Uint8Array }
	aes256GcmDecrypt(
		key: Uint8Array,
		nonce: Uint8Array,
		ciphertext: Uint8Array,
		tag: Uint8Array,
	): Uint8Array
	hkdfSha256(ikm: Uint8Array, salt: Uint8Array, info: string, length: number): Uint8Array
	x25519GenerateKeyPair(): X25519KeyPairBytes
	x25519PublicKey(privateKey: Uint8Array): Uint8Array
	x25519SharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array
	sha256(data: Uint8Array): Uint8Array
	argon2id(password: string, options: Argon2idOptions): Promise<Uint8Array>
	gzip(data: Uint8Array): Promise<Uint8Array>
	gunzip(data: Uint8Array): Promise<Uint8Array>
}
