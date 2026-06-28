import { noteCache, useRemoteVaultStore, useVaultStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { loadNotePropertiesSnapshot, resetPropertiesRuntime } from "@cortex/properties"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { initializeDesktopProperties } from "../propertiesRuntime"

const vaultPath = "/vault"
const notePath = "/vault/Untitled.md"
const schemaPath = "/vault/.cortex/schema/properties.json"

beforeEach(() => {
	vi.useFakeTimers()
	vi.setSystemTime(new Date("2026-06-19T12:00:00.000Z"))
	noteCache.clear()
	resetPropertiesRuntime()
	useVaultStore.setState({
		vault: {
			uuid: "vault-id",
			path: vaultPath,
			name: "Vault",
			fileCount: 1,
		},
	})
	useRemoteVaultStore.setState({
		linkedVaultId: "remote-vault-id",
		syncConfig: {
			enabled: true,
			remoteVaultId: "remote-vault-id",
			selfHosted: false,
			serverUrl: "https://sync.example.com",
			offlineMode: false,
			selfHostedEnvironment: {},
		},
	})
	vi.clearAllMocks()
})

afterEach(() => {
	noteCache.clear()
	resetPropertiesRuntime()
	vi.useRealTimers()
})

describe("desktop properties runtime", () => {
	it("does not apply stale remote metadata to a freshly created local note", async () => {
		const files = new Map([
			[
				schemaPath,
				JSON.stringify({
					version: 1,
					properties: [
						{
							id: "11111111-1111-4111-8111-111111111111",
							key: "created-time",
							name: "Created time",
							type: "created_time",
							createdAt: "2026-06-01T00:00:00.000Z",
						},
					],
				}),
			],
			[notePath, "Body"],
		])
		vi.mocked(getPlatform).mockReturnValue({
			fs: {
				readFile: vi.fn(async (path: string) => {
					const content = files.get(path)
					if (content === undefined) throw new Error(`Missing ${path}`)
					return content
				}),
				atomicWriteFile: vi.fn(),
				getFileMetadata: vi.fn().mockResolvedValue({
					createdAt: new Date("2026-06-19T12:00:00.000Z").getTime(),
					modifiedAt: new Date("2026-06-19T12:00:00.000Z").getTime(),
				}),
			},
			device: {
				getDeviceInfo: vi.fn().mockResolvedValue({
					deviceId: "local-device",
					deviceName: "Local Mac",
					deviceType: "desktop",
				}),
				getDeviceId: vi.fn().mockResolvedValue("local-device"),
			},
			sync: {
				getNoteMetadata: vi.fn().mockResolvedValue({
					createdAt: "2024-01-01T00:00:00.000Z",
					createdBy: "old-user",
					lastEditedAt: "2024-01-02T00:00:00.000Z",
					lastEditedBy: "old-user",
					lastDeviceId: null,
					synced: true,
				}),
			},
		} as never)
		noteCache.primeClean(notePath, "Body", "hash-new", { localCreated: true })
		initializeDesktopProperties()

		const snapshot = await loadNotePropertiesSnapshot(notePath)

		expect(snapshot.resolvedMeta["created-time"]).toBe("2026-06-19T12:00:00.000Z")
	})
})
