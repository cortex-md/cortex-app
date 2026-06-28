import { initializeProperties } from "../../runtime"
import type { PropertiesRuntime, PropertyAuthorContext } from "../../types"

export interface TestPropertiesRuntime {
	files: Map<string, string>
	atomicWrites: string[]
	authorContext: PropertyAuthorContext
	runtime: PropertiesRuntime
}

export function createTestPropertiesRuntime(
	initialFiles: Record<string, string> = {},
): TestPropertiesRuntime {
	const files = new Map(Object.entries(initialFiles))
	const atomicWrites: string[] = []
	const authorContext: PropertyAuthorContext = {
		authenticated: false,
		remoteVaultId: null,
		currentUserId: null,
		members: [],
		currentDeviceId: "test-device",
		devices: [{ id: "test-device", label: "Test device", current: true }],
	}
	const read = async (path: string) => {
		const value = files.get(path)
		if (value === undefined) throw new Error(`No such file: ${path}`)
		return value
	}
	const runtime: PropertiesRuntime = {
		files: {
			readFile: read,
			atomicWriteFile: async (path, content) => {
				atomicWrites.push(path)
				files.set(path, content)
			},
		},
		notes: {
			readNote: read,
			writeNote: async (path, content) => {
				files.set(path, content)
			},
			resolveVaultPath: (filePath) => (filePath.startsWith("/vault/") ? "/vault" : null),
			listMarkdownFiles: async (vaultPath) =>
				Array.from(files.keys()).filter(
					(path) => path.startsWith(`${vaultPath}/`) && path.endsWith(".md"),
				),
		},
		identity: {
			getAuthorContext: async () => authorContext,
		},
		metadata: {
			getNoteSourceMetadata: async () => ({
				source: "local",
				synced: false,
				dirty: false,
				createdAt: "2026-06-12T08:00:00.000Z",
				lastEditedAt: "2026-06-12T09:00:00.000Z",
			}),
		},
		now: () => new Date("2026-06-13T12:00:00.000Z"),
		createId: () => "11111111-1111-4111-8111-111111111111",
	}
	initializeProperties(runtime)
	return { files, atomicWrites, authorContext, runtime }
}
