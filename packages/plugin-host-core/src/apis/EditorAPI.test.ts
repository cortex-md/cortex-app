import { afterEach, describe, expect, it, vi } from "vitest"
import { pluginStore } from "../pluginStore"
import { createEditorAPI, setEditorViewRef, setReconfigurePluginExtensions } from "./EditorAPI"

function createView() {
	return {
		dispatch: vi.fn(),
		state: {
			doc: { toString: () => "body" },
			selection: { main: { from: 0, to: 0 } },
		},
	}
}

afterEach(() => {
	setEditorViewRef(null)
	setReconfigurePluginExtensions(() => {})
	pluginStore.getState().reset()
})

describe("EditorAPI extension reconfiguration", () => {
	it("lets async reconfiguration apply only the latest extension snapshot", async () => {
		pluginStore.getState().registerPlugin({
			id: "editor-plugin",
			name: "Editor Plugin",
			version: "0.1.0",
			minAppVersion: "0.1.0",
			author: "Cortex",
			description: "Test plugin",
			icon: "pencil",
			main: "index.ts",
			capabilities: ["editor:extensions"],
		})
		const view = createView()
		const resolvers: Array<() => void> = []
		const appliedSnapshots: unknown[][] = []
		setReconfigurePluginExtensions(async (_view, contributions, isCurrent) => {
			await new Promise<void>((resolve) => {
				resolvers.push(resolve)
			})
			if (isCurrent?.()) appliedSnapshots.push([...contributions.extensions])
		})
		setEditorViewRef(view)
		const api = createEditorAPI("editor-plugin")

		const first = api.registerExtension("first")
		const second = api.registerExtension("second")
		expect(resolvers).toHaveLength(3)

		resolvers[2]()
		await Promise.resolve()
		expect(appliedSnapshots).toEqual([["first", "second"]])

		resolvers[1]()
		resolvers[0]()
		await Promise.resolve()
		expect(appliedSnapshots).toEqual([["first", "second"]])

		first.dispose()
		second.dispose()
	})

	it("registers portable fold providers behind the folding capability", () => {
		pluginStore.getState().registerPlugin({
			id: "fold-plugin",
			name: "Fold Plugin",
			version: "0.1.0",
			minAppVersion: "0.1.0",
			author: "Cortex",
			description: "Test plugin",
			icon: "chevrons-up-down",
			main: "index.ts",
			capabilities: ["editor:folding"],
		})
		const view = createView()
		const appliedSnapshots: Array<{
			extensions: unknown[]
			foldProviders: Array<{
				id: string
				label?: string
				priority?: number
				pluginId: string
				registrationKey: string
			}>
		}> = []
		setReconfigurePluginExtensions((_view, contributions) => {
			appliedSnapshots.push({
				extensions: [...contributions.extensions],
				foldProviders: contributions.foldProviders.map((provider) => ({
					id: provider.id,
					label: provider.label,
					priority: provider.priority,
					pluginId: provider.pluginId,
					registrationKey: provider.registrationKey,
				})),
			})
		})
		setEditorViewRef(view)
		const api = createEditorAPI("fold-plugin")

		const disposable = api.registerFoldProvider({
			id: "sections",
			label: "Sections",
			priority: 10,
			getFoldRange: () => ({ toLine: 3 }),
		})

		expect(appliedSnapshots.at(-1)?.foldProviders).toMatchObject([
			{
				id: "sections",
				label: "Sections",
				priority: 10,
				pluginId: "fold-plugin",
			},
		])

		disposable.dispose()
		expect(appliedSnapshots.at(-1)?.foldProviders).toEqual([])
	})

	it("requires editor:folding for portable fold providers", () => {
		pluginStore.getState().registerPlugin({
			id: "read-plugin",
			name: "Read Plugin",
			version: "0.1.0",
			minAppVersion: "0.1.0",
			author: "Cortex",
			description: "Test plugin",
			icon: "pencil",
			main: "index.ts",
			capabilities: ["editor:read"],
		})
		const api = createEditorAPI("read-plugin")

		expect(() =>
			api.registerFoldProvider({
				id: "sections",
				getFoldRange: () => ({ toLine: 2 }),
			}),
		).toThrow('Plugin "read-plugin" requires the editor:folding capability')
	})
})
