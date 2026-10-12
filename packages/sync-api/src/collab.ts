import { type ApiClient, normalizeServerUrl, segment, withQuery } from "./client"
import { toRecord } from "./mappers"

export interface CollabTicket {
	ticket: string
	expiresAt: string | null
}

export async function createCollabTicket(
	api: ApiClient,
	vaultId: string,
	filePath: string,
): Promise<CollabTicket> {
	const raw = toRecord(
		await api.json<unknown>(
			"POST",
			`/sync/v1/vaults/${segment(vaultId)}/collab/tickets`,
			"Create collaboration ticket",
			{ json: { file_path: filePath } },
		),
	)
	const ticket = typeof raw.ticket === "string" ? raw.ticket : ""
	if (!ticket) throw new Error("Create collaboration ticket: missing ticket")
	return { ticket, expiresAt: typeof raw.expires_at === "string" ? raw.expires_at : null }
}

export function collabSocketUrl(
	serverUrl: string,
	vaultId: string,
	filePath: string,
	ticket: string,
): string {
	const base = normalizeServerUrl(serverUrl).replace(/^http(s?):\/\//, "ws$1://")
	return `${base}${withQuery(`/sync/v1/vaults/${segment(vaultId)}/collab`, {
		path: filePath,
		ticket,
		frames: "binary",
	})}`
}
