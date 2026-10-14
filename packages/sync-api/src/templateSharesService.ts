import type {
	PublicTemplateInfo,
	TemplateBundle,
	TemplateShareAudience,
	TemplateShareInfo,
	TemplateShares,
} from "@cortex/platform"
import type { ShareServiceDeps } from "./noteSharesService"
import { vekSecretKey } from "./secrets"
import {
	createTemplateShare,
	fetchPublicTemplate,
	fetchTemplatePayload,
	listMarketTemplates,
	listTemplateShares,
	publishTemplatePayload,
	type RemotePublicTemplate,
	type RemoteTemplateShare,
	revokeTemplateShare,
	updateTemplateShare,
} from "./templates"

export function createTemplateSharesService({
	secrets,
	client,
	crypto,
}: ShareServiceDeps): TemplateShares {
	const { decodeVek, openShareBundle, sealShareBundle } = crypto
	const serverApi = { client }

	function vaultKey(vaultId: string): Uint8Array {
		const encoded = secrets.get(vekSecretKey(vaultId))
		if (!encoded) throw new Error("Unlock this vault before sharing templates with your team.")
		return decodeVek(encoded)
	}

	function templateLink(share: RemoteTemplateShare, base: string): string | null {
		if (share.audience === "team" || !share.slug) return null
		const server = encodeURIComponent(base)
		return `cortex://t/${encodeURIComponent(share.slug)}?server=${server}`
	}

	function toInfo(share: RemoteTemplateShare, base: string): TemplateShareInfo {
		return {
			id: share.id,
			vaultId: share.vaultId,
			kind: share.kind,
			audience: share.audience,
			groupId: share.groupId,
			groupName: share.groupName,
			ownerId: share.ownerId,
			ownerName: share.ownerName,
			name: share.name,
			description: share.description,
			includeSamples: share.includeSamples,
			version: share.version,
			status: share.status,
			reviewNote: share.reviewNote,
			link: templateLink(share, base),
			updatedAt: share.updatedAt,
		}
	}

	function toPublicInfo(template: RemotePublicTemplate): PublicTemplateInfo {
		return { ...template }
	}

	function encodeBundle(bundle: TemplateBundle): Uint8Array {
		return new TextEncoder().encode(JSON.stringify(bundle))
	}

	function parseBundle(bytes: Uint8Array): TemplateBundle {
		const raw = JSON.parse(new TextDecoder().decode(bytes)) as Partial<TemplateBundle>
		if (raw.format !== 1 || !Array.isArray(raw.files)) throw new Error("Unsupported template")
		return {
			format: 1,
			kind: raw.kind === "database" ? "database" : "note",
			files: raw.files.flatMap((file) =>
				file && typeof file.path === "string" && typeof file.content === "string"
					? [{ path: file.path, content: file.content }]
					: [],
			),
		}
	}

	async function sealPayload(
		vaultId: string,
		audience: TemplateShareAudience,
		bundle: TemplateBundle,
	): Promise<{ payload: Uint8Array; encrypted: boolean }> {
		const plaintext = encodeBundle(bundle)
		if (audience !== "team") return { payload: plaintext, encrypted: false }
		return { payload: await sealShareBundle(plaintext, vaultKey(vaultId)), encrypted: true }
	}

	return {
		list: async (vaultId) => {
			const api = await serverApi.client()
			return (await listTemplateShares(api, vaultId)).map((share) => toInfo(share, api.serverUrl))
		},
		share: async (vaultId, input) => {
			const sealed = await sealPayload(vaultId, input.audience, input.bundle)
			const api = await serverApi.client()
			const share = await createTemplateShare(api, vaultId, {
				kind: input.kind,
				audience: input.audience,
				groupId: input.audience === "team" ? input.groupId : null,
				name: input.name,
				description: input.description,
				includeSamples: input.includeSamples,
				...sealed,
			})
			return toInfo(share, api.serverUrl)
		},
		update: async (vaultId, templateId, patch) => {
			const { bundle, ...fields } = patch
			const sealed =
				bundle && patch.audience ? await sealPayload(vaultId, patch.audience, bundle) : null
			const api = await serverApi.client()
			const share = await updateTemplateShare(api, vaultId, templateId, {
				...fields,
				...(sealed ? sealed : {}),
			})
			return toInfo(share, api.serverUrl)
		},
		republish: async (vaultId, templateId, audience, bundle) => {
			const sealed = await sealPayload(vaultId, audience, bundle)
			const api = await serverApi.client()
			const share = await publishTemplatePayload(
				api,
				vaultId,
				templateId,
				sealed.payload,
				sealed.encrypted,
			)
			return toInfo(share, api.serverUrl)
		},
		revoke: async (vaultId, templateId) => {
			await revokeTemplateShare(await serverApi.client(), vaultId, templateId)
		},
		fetch: async (vaultId, templateId) => {
			const result = await fetchTemplatePayload(await serverApi.client(), vaultId, templateId)
			const plaintext = result.encrypted
				? await openShareBundle(result.payload, vaultKey(vaultId))
				: result.payload
			return parseBundle(plaintext)
		},
		market: async (query) =>
			(await listMarketTemplates(await serverApi.client(), query)).map(toPublicInfo),
		open: async (slug) => {
			const result = await fetchPublicTemplate(await serverApi.client(), slug)
			return { template: toPublicInfo(result.template), bundle: parseBundle(result.payload) }
		},
	} satisfies TemplateShares
}
