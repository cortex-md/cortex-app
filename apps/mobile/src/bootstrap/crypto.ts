import * as ExpoCrypto from "expo-crypto"

interface CryptoWithOptionalUuid {
	randomUUID?: () => string
}

export function installMobileCrypto(): void {
	const existingCrypto = globalThis.crypto as CryptoWithOptionalUuid | undefined
	if (existingCrypto?.randomUUID) return

	if (existingCrypto) {
		Object.defineProperty(existingCrypto, "randomUUID", {
			configurable: true,
			value: () => ExpoCrypto.randomUUID(),
		})
		return
	}

	Object.defineProperty(globalThis, "crypto", {
		configurable: true,
		value: {
			randomUUID: () => ExpoCrypto.randomUUID(),
		},
	})
}
