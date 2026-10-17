import * as ExpoCrypto from "expo-crypto"

type RandomValuesTarget = Parameters<typeof ExpoCrypto.getRandomValues>[0]

const webcryptoShim = {
	ensureSecure(): void {},
	getRandomValues<T extends RandomValuesTarget>(values: T): T {
		return ExpoCrypto.getRandomValues(values)
	},
	get subtle(): SubtleCrypto | undefined {
		return globalThis.crypto?.subtle
	},
}

export default webcryptoShim
