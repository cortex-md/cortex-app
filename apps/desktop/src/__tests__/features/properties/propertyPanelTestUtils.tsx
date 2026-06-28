import { noteCache, useTagsStore, useVaultStore } from "@cortex/core"
import {
	initializeProperties,
	invalidatePropertySuggestions,
	type PropertiesRuntime,
	type PropertyAuthorContext,
	type VaultSchema,
} from "@cortex/properties"
import { cleanup, type RenderResult, render } from "@testing-library/react"
import { NotePropertiesPanel } from "../../../features/properties/NotePropertiesPanel"

const vaultPath = "/vault"
export const notePath = "/vault/note.md"
export const schemaPath = "/vault/.cortex/schema/properties.json"
export const uiStatePath = "/vault/.cortex/ui-state.json"

export interface PanelTestRuntime {
	files: Map<string, string>
	authorContext: PropertyAuthorContext
	propertiesRuntime: PropertiesRuntime
}

export function initializePanelRuntime(schema: VaultSchema, note: string): PanelTestRuntime {
	const files = new Map<string, string>([
		[schemaPath, JSON.stringify(schema)],
		[notePath, note],
	])
	const authorContext: PropertyAuthorContext = {
		authenticated: false,
		remoteVaultId: null,
		currentUserId: null,
		members: [],
		currentDeviceId: "desktop-test",
		devices: [{ id: "desktop-test", label: "Test device", current: true }],
	}
	const read = async (path: string) => {
		const content = files.get(path)
		if (content === undefined) throw new Error(`No such file: ${path}`)
		return content
	}
	const runtime: PropertiesRuntime = {
		files: {
			readFile: read,
			atomicWriteFile: async (path, content) => {
				files.set(path, content)
			},
		},
		notes: {
			readNote: read,
			writeNote: async (path, content) => {
				files.set(path, content)
				noteCache.writeExternal(path, content)
			},
			resolveVaultPath: (filePath) => (filePath.startsWith(`${vaultPath}/`) ? vaultPath : null),
			listMarkdownFiles: async () => [notePath],
		},
		identity: {
			getAuthorContext: async () => authorContext,
		},
		metadata: {
			getNoteSourceMetadata: async () => ({
				source: "local",
				synced: false,
				dirty: false,
				createdAt: "2026-06-13T00:00:00.000Z",
				lastEditedAt: "2026-06-13T00:00:00.000Z",
			}),
		},
	}
	initializeProperties(runtime)
	invalidatePropertySuggestions()
	return { files, authorContext, propertiesRuntime: runtime }
}

export async function renderPanel(
	schema: VaultSchema,
	note: string,
): Promise<RenderResult & { runtime: PanelTestRuntime }> {
	const runtime = initializePanelRuntime(schema, note)
	await noteCache.read(notePath)
	const rendered = render(<NotePropertiesPanel filePath={notePath} />)
	return { ...rendered, runtime }
}

export function setupPropertyPanelTest() {
	noteCache.clear()
	useTagsStore.setState({
		tagIndex: {},
		tagColors: {},
		fileTags: {},
		activeTagFilter: null,
	})
	useVaultStore.setState({
		vault: {
			uuid: "vault-id",
			path: vaultPath,
			name: "Vault",
			fileCount: 1,
		},
	})
}

export function cleanupPropertyPanelTest() {
	cleanup()
	noteCache.clear()
	useTagsStore.setState({
		tagIndex: {},
		tagColors: {},
		fileTags: {},
		activeTagFilter: null,
	})
}
