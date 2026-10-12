import type { ContextMenuActionContext } from "@cortex.md/api"
import { describe, expect, it, vi } from "vitest"
import { createPluginContextMenuItems } from "../../../features/plugins/pluginContextMenu"

describe("plugin context menu items", () => {
	it("renders plugin actions as one flat section for a matching location", () => {
		const firstAction = vi.fn()
		const secondAction = vi.fn()
		const context = {
			location: "file",
			filePath: "/vault/Note.md",
		} satisfies ContextMenuActionContext
		const items = createPluginContextMenuItems(
			{
				contextMenuItems: [
					{
						owner: "alpha",
						id: "first",
						key: "alpha:first",
						label: "First plugin action",
						location: "file",
						action: firstAction,
					},
					{
						owner: "alpha",
						id: "ignored",
						key: "alpha:ignored",
						label: "Ignored editor action",
						location: "editor",
						action: vi.fn(),
					},
					{
						owner: "beta",
						id: "second",
						key: "beta:second",
						label: "Second plugin action",
						location: "file",
						action: secondAction,
					},
				],
			},
			"file",
			context,
		)

		expect(items.map((item) => (item.type === "separator" ? "separator" : item.id))).toEqual([
			"separator",
			"plugin-file-alpha:first",
			"plugin-file-beta:second",
		])
		expect(items.some((item) => item.type === "submenu")).toBe(false)

		const firstPluginItem = items[1]
		expect(firstPluginItem.type).not.toBe("separator")
		if (firstPluginItem.type === undefined || firstPluginItem.type === "normal") {
			firstPluginItem.action?.()
		}

		expect(firstAction).toHaveBeenCalledWith(context)
		expect(secondAction).not.toHaveBeenCalled()
	})

	it("does not add a separator when no plugin actions match", () => {
		const items = createPluginContextMenuItems(
			{
				contextMenuItems: [
					{
						owner: "alpha",
						id: "editor-only",
						key: "alpha:editor-only",
						label: "Editor only",
						location: "editor",
						action: vi.fn(),
					},
				],
			},
			"file",
			{ location: "file", filePath: "/vault/Note.md" },
		)

		expect(items).toEqual([])
	})
})
