import type { NoteShareInfo, SharedNoteBundle, Shares } from "@cortex/platform"
import type { ApiClient } from "./client"
import type { SecretStore } from "./secrets"
import { vekSecretKey } from "./secrets"
import {
	createShare,
	fetchSharedContent,
	listShares,
	publishShareContent,
	type RemoteShare,
	revokeShare,
	updateShareExpiry,
} from "./shares"

export interface ShareKeyMaterial {
	key: Uint8Array
	wrappedKey: string
}

export interface ShareCrypto {
	decodeVek(encoded: string): Uint8Array
	createShareKey(vek: Uint8Array): ShareKeyMaterial
	unwrapShareKey(wrappedKey: string, vek: Uint8Array): Uint8Array
	encodeShareKey(key: Uint8Array): string
	decodeShareKey(encoded: string): Uint8Array
	sealShareBundle(plaintext: Uint8Array, key: Uint8Array): Promise<Uint8Array>
	openShareBundle(ciphertext: Uint8Array, key: Uint8Array): Promise<Uint8Array>
}

export interface ShareServiceDeps {
	secrets: SecretStore
	client: () => Promise<ApiClient>
	crypto: ShareCrypto
}

export function createNoteSharesService({ secrets, client, crypto }: ShareServiceDeps): Shares {
	const {
		createShareKey,
		decodeShareKey,
		decodeVek,
		encodeShareKey,
		openShareBundle,
		sealShareBundle,
		unwrapShareKey,
	} = crypto
	const serverApi = { client }

	function vaultKey(vaultId: string): Uint8Array {
		const encoded = secrets.get(vekSecretKey(vaultId))
		if (!encoded) throw new Error("Unlock this vault before sharing its notes.")
		return decodeVek(encoded)
	}

	function shareLink(share: RemoteShare, key: Uint8Array | null): string | null {
		return key && share.revision > 0 ? `${share.url}#k=${encodeShareKey(key)}` : null
	}

	function toInfo(share: RemoteShare, key: Uint8Array | null): NoteShareInfo {
		return {
			id: share.id,
			vaultId: share.vaultId,
			filePath: share.filePath,
			link: shareLink(share, key),
			revision: share.revision,
			sizeBytes: share.sizeBytes,
			expiresAt: share.expiresAt,
			createdBy: share.createdBy,
			updatedAt: share.updatedAt,
		}
	}

	function keyFor(share: RemoteShare, vek: Uint8Array | null): Uint8Array | null {
		if (!vek) return null
		try {
			return unwrapShareKey(share.wrappedKey, vek)
		} catch {
			return null
		}
	}

	function optionalVaultKey(vaultId: string): Uint8Array | null {
		try {
			return vaultKey(vaultId)
		} catch {
			return null
		}
	}

	function encodeBundle(bundle: SharedNoteBundle): Uint8Array {
		return new TextEncoder().encode(JSON.stringify(bundle))
	}

	function parseBundle(plaintext: Uint8Array): SharedNoteBundle {
		const bundle = JSON.parse(new TextDecoder().decode(plaintext)) as SharedNoteBundle
		if (bundle.v !== 1 || typeof bundle.markdown !== "string")
			throw new Error("Unsupported shared note")
		return {
			v: 1,
			title: String(bundle.title ?? ""),
			markdown: bundle.markdown,
			html: String(bundle.html ?? ""),
			attachments: Array.isArray(bundle.attachments) ? bundle.attachments : [],
		}
	}

	return {
		list: async (vaultId) => {
			const shares = await listShares(await serverApi.client(), vaultId)
			const vek = optionalVaultKey(vaultId)
			return shares.map((share) => toInfo(share, keyFor(share, vek)))
		},
		publish: async (vaultId, filePath, bundle, expiresAt = null) => {
			const api = await serverApi.client()
			const vek = vaultKey(vaultId)
			const fresh = createShareKey(vek)
			const share = await createShare(api, vaultId, filePath, fresh.wrappedKey, expiresAt)
			const key =
				share.wrappedKey === fresh.wrappedKey ? fresh.key : unwrapShareKey(share.wrappedKey, vek)
			const published = await publishShareContent(
				api,
				vaultId,
				share.id,
				await sealShareBundle(encodeBundle(bundle), key),
			)
			return toInfo(published, key)
		},
		updateExpiry: async (vaultId, shareId, expiresAt) => {
			const share = await updateShareExpiry(await serverApi.client(), vaultId, shareId, expiresAt)
			return toInfo(share, keyFor(share, optionalVaultKey(vaultId)))
		},
		revoke: async (vaultId, shareId) => {
			await revokeShare(await serverApi.client(), vaultId, shareId)
		},
		open: async (shareId, key) => {
			const ciphertext = await fetchSharedContent(await serverApi.client(), shareId)
			return parseBundle(await openShareBundle(ciphertext, decodeShareKey(key)))
		},
	} satisfies Shares
}
