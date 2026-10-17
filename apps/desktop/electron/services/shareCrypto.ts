import type { ShareCrypto } from "@cortex/sync-api"
import {
	createShareKey,
	decodeShareKey,
	decodeVek,
	encodeShareKey,
	openShareBundle,
	sealShareBundle,
	unwrapShareKey,
} from "@cortex/sync-engine"

export const shareCrypto: ShareCrypto = {
	decodeVek,
	createShareKey,
	unwrapShareKey,
	encodeShareKey,
	decodeShareKey,
	sealShareBundle,
	openShareBundle,
}
