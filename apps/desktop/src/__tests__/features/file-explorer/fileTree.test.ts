import { describe, expect, it } from "vitest"
import { buildFileTree, flattenVisibleFileTree } from "../../../features/file-explorer/fileTree"

describe("file tree model", () => {
	it("indexes each entry into a sorted hierarchy", () => {
		const entries = Array.from({ length: 10_000 }, (_, index) => ({
			path: `/vault/folder-${Math.floor(index / 100)}/note-${index}.md`,
			name: `note-${index}.md`,
			isDir: false,
		}))
		for (let index = 0; index < 100; index++) {
			entries.push({
				path: `/vault/folder-${index}`,
				name: `folder-${index}`,
				isDir: true,
			})
		}

		const tree = buildFileTree(entries, "/vault")

		expect(tree).toHaveLength(100)
		expect(tree.reduce((count, node) => count + node.children.length, 0)).toBe(10_000)
	})

	it("normalizes Windows separators before building the hierarchy", () => {
		const tree = buildFileTree(
			[
				{ path: "C:\\Users\\Luiza\\Vault\\Folder", name: "Folder", isDir: true },
				{
					path: "C:\\Users\\Luiza\\Vault\\Folder\\Nested.md",
					name: "Nested.md",
					isDir: false,
				},
				{ path: "C:\\Users\\Luiza\\Vault\\Note.md", name: "Note.md", isDir: false },
			],
			"C:\\Users\\Luiza\\Vault",
		)

		expect(tree).toMatchObject([
			{
				name: "Folder",
				path: "C:/Users/Luiza/Vault/Folder",
				children: [{ path: "C:/Users/Luiza/Vault/Folder/Nested.md" }],
			},
			{ name: "Note.md", path: "C:/Users/Luiza/Vault/Note.md" },
		])
	})

	it("flattens only expanded directories and inserts creation rows", () => {
		const tree = buildFileTree(
			[
				{ path: "/vault/folder", name: "folder", isDir: true },
				{ path: "/vault/folder/note.md", name: "note.md", isDir: false },
				{ path: "/vault/root.md", name: "root.md", isDir: false },
			],
			"/vault",
		)

		expect(flattenVisibleFileTree(tree, new Set(), null, null)).toHaveLength(2)
		expect(
			flattenVisibleFileTree(tree, new Set(["/vault/folder"]), "/vault/folder", "file"),
		).toMatchObject([
			{ kind: "node", depth: 0 },
			{ kind: "create", depth: 1 },
			{ kind: "node", depth: 1 },
			{ kind: "node", depth: 0 },
		])
	})
})
