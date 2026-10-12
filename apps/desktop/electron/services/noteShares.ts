import type { NoteShareInfo, SharedNoteBundle, Shares } from "@cortex/platform"
import {
	createShare,
	fetchSharedContent,
	listShares,
	publishShareContent,
	type RemoteShare,
	revokeShare,
	updateShareExpiry,
} from "@cortex/sync-api"
import {
	createShareKey,
	decodeShareKey,
	decodeVek,
	encodeShareKey,
	openShareBundle,
	sealShareBundle,
	unwrapShareKey,
	vekSecretKey,
} from "@cortex/sync-engine"
import { secrets, serverApi } from "./serverApi"

function vaultKey(vaultId: string): Buffer {
	const encoded = secrets.get(vekSecretKey(vaultId))
	if (!encoded) throw new Error("Unlock this vault before sharing its notes.")
	return decodeVek(encoded)
}

function shareLink(share: RemoteShare, key: Buffer | null): string | null {
	return key && share.revision > 0 ? `${share.url}#k=${encodeShareKey(key)}` : null
}

function toInfo(share: RemoteShare, key: Buffer | null): NoteShareInfo {
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

function keyFor(share: RemoteShare, vek: Buffer | null): Buffer | null {
	if (!vek) return null
	try {
		return unwrapShareKey(share.wrappedKey, vek)
	} catch {
		return null
	}
}

function optionalVaultKey(vaultId: string): Buffer | null {
	try {
		return vaultKey(vaultId)
	} catch {
		return null
	}
}

function encodeBundle(bundle: SharedNoteBundle): Uint8Array {
	return new TextEncoder().encode(JSON.stringify(bundle))
}

function parseBundle(plaintext: Buffer): SharedNoteBundle {
	const bundle = JSON.parse(plaintext.toString("utf8")) as SharedNoteBundle
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

export const noteSharesApi = {
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
