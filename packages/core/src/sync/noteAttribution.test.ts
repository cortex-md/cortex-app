import { describe, expect, it, vi } from "vitest"
import {
	formatNoteEditedAt,
	loadNoteSyncAttribution,
	resolveNoteSyncAttribution,
} from "./noteAttribution"

const completeMetadata = {
	createdAt: "2026-06-01T12:00:00.000Z",
	createdBy: "user-1",
	lastEditedAt: "2026-06-15T11:59:00.000Z",
	lastEditedBy: "user-2",
	lastDeviceId: "device-1",
	synced: true,
}

describe("note sync attribution", () => {
	it("resolves the latest editor from the vault member snapshot", async () => {
		const loadMetadata = vi.fn().mockResolvedValue(completeMetadata)
		const loadMembers = vi.fn().mockResolvedValue([
			{
				vaultId: "vault-id",
				userId: "user-2",
				email: "ada@example.com",
				displayName: "Ada Lovelace",
				role: "editor",
				joinedAt: "2026-06-01T00:00:00.000Z",
			},
		])

		await expect(
			loadNoteSyncAttribution({
				syncEnabled: true,
				remoteVaultId: "vault-id",
				vaultPath: "/vault",
				filePath: "/vault/notes/current.md",
				currentUser: null,
				loadMetadata,
				loadMembers,
			}),
		).resolves.toEqual({
			actorId: "user-2",
			displayName: "Ada Lovelace",
			email: "ada@example.com",
			editedAt: completeMetadata.lastEditedAt,
		})
		expect(loadMetadata).toHaveBeenCalledWith("/vault", "notes/current.md")
		expect(loadMembers).toHaveBeenCalledWith("vault-id")
	})

	it("does not load metadata or members when sync is disabled", async () => {
		const loadMetadata = vi.fn()
		const loadMembers = vi.fn()

		await expect(
			loadNoteSyncAttribution({
				syncEnabled: false,
				remoteVaultId: "vault-id",
				vaultPath: "/vault",
				filePath: "/vault/current.md",
				currentUser: null,
				loadMetadata,
				loadMembers,
			}),
		).resolves.toBeNull()
		expect(loadMetadata).not.toHaveBeenCalled()
		expect(loadMembers).not.toHaveBeenCalled()
	})

	it("does not load members for incomplete sync metadata", async () => {
		const loadMembers = vi.fn()

		await expect(
			loadNoteSyncAttribution({
				syncEnabled: true,
				remoteVaultId: "vault-id",
				vaultPath: "/vault",
				filePath: "/vault/current.md",
				currentUser: null,
				loadMetadata: vi.fn().mockResolvedValue({
					...completeMetadata,
					lastEditedBy: null,
				}),
				loadMembers,
			}),
		).resolves.toBeNull()
		expect(loadMembers).not.toHaveBeenCalled()
	})

	it("uses the authenticated account before falling back to an unknown member", () => {
		expect(
			resolveNoteSyncAttribution(completeMetadata, [], {
				userId: "user-2",
				email: "ada@example.com",
				displayName: null,
			}),
		).toEqual(
			expect.objectContaining({
				displayName: "ada@example.com",
				email: "ada@example.com",
			}),
		)
		expect(resolveNoteSyncAttribution(completeMetadata, [], null)).toEqual(
			expect.objectContaining({
				displayName: "Unknown member",
				email: null,
			}),
		)
	})

	it("formats relative edit times with an injected clock", () => {
		const now = new Date("2026-06-15T12:00:00.000Z").getTime()
		expect(formatNoteEditedAt("2026-06-15T12:00:00.000Z", () => now)).toBe("just now")
		expect(formatNoteEditedAt("2026-06-15T11:59:00.000Z", () => now)).toBe("1 minute ago")
		expect(formatNoteEditedAt("2026-06-15T10:00:00.000Z", () => now)).toBe("2 hours ago")
		expect(formatNoteEditedAt("2026-06-13T12:00:00.000Z", () => now)).toBe("2 days ago")
	})
})
