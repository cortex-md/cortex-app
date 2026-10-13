import type { RemoteVaultInfo } from "@cortex/platform"

export const FIXTURE_SELF_HOSTED_SERVER = "sync.example.org"

function remote(
	id: string,
	name: string,
	role: string,
	memberCount: number,
	ownerId: string,
): RemoteVaultInfo {
	return {
		id,
		name,
		description: null,
		icon: null,
		ownerId,
		role,
		memberCount,
		hasKey: true,
		allowedEmailDomains: [],
		allowGuests: false,
		allowPublicLinks: false,
		storageUsedBytes: 0,
		storageQuotaBytes: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	}
}

export const FIXTURE_CLOUD_REMOTE_VAULTS: RemoteVaultInfo[] = [
	remote("remote-work", "Work", "owner", 4, "user-ana"),
	remote("remote-design", "Design", "viewer", 7, "user-bruno"),
	remote("remote-family", "Family", "owner", 2, "user-ana"),
]

export const FIXTURE_SELF_HOSTED_REMOTE_VAULTS: RemoteVaultInfo[] = [
	remote("remote-lab-notes", "Lab notes", "editor", 3, "user-carla"),
	remote("remote-archive", "Archive", "owner", 1, "user-ana"),
]

export const FIXTURE_DOWNLOAD_PROGRESS = 0.38
