import type { FileEntry } from "@cortex/platform"
import { describe, expect, it } from "vitest"
import type { FileTreeNode } from "../utils/fileTree"
import { VaultIndex, type VaultIndexChange } from "./vaultIndex"

const ROOT = "/vault"

function dir(path: string): FileEntry {
	return { path: `${ROOT}/${path}`, name: path.split("/").at(-1) ?? path, isDir: true }
}

function file(path: string, mtime = 1, size = 1): FileEntry {
	return {
		path: `${ROOT}/${path}`,
		name: path.split("/").at(-1) ?? path,
		isDir: false,
		mtime,
		size,
	}
}

function treeShape(nodes: readonly FileTreeNode[]): unknown[] {
	return nodes.map((node) => (node.isDir ? { [node.name]: treeShape(node.children) } : node.name))
}

function snapshot(index: VaultIndex) {
	return {
		files: index.collectSubtree(ROOT).map((entry) => ({ ...entry })),
		tree: treeShape(index.getRoots()),
	}
}

describe("VaultIndex", () => {
	it("sorts folders first with numeric, case-insensitive names", () => {
		const index = new VaultIndex(ROOT, [
			file("Note 10.md"),
			file("note 2.md"),
			dir("b"),
			file("Alpha.md"),
			dir("A"),
		])
		expect(treeShape(index.getRoots())).toEqual([
			{ A: [] },
			{ b: [] },
			"Alpha.md",
			"note 2.md",
			"Note 10.md",
		])
	})

	it("applies created, modified and deleted entries incrementally", () => {
		const index = new VaultIndex(ROOT, [dir("Projects"), file("Projects/a.md")])
		const created = index.apply([{ kind: "upsert", entry: file("Projects/b.md") }])
		expect(created.added.map((entry) => entry.name)).toEqual(["b.md"])
		expect(created.changedFolders).toEqual([`${ROOT}/Projects`])

		const modified = index.apply([{ kind: "upsert", entry: file("Projects/a.md", 5, 9) }])
		expect(modified.modified.map((entry) => entry.mtime)).toEqual([5])
		expect(modified.changedFolders).toEqual([])
		expect(index.get(`${ROOT}/Projects/a.md`)?.size).toBe(9)

		const removed = index.apply([{ kind: "remove", path: `${ROOT}/Projects/a.md` }])
		expect(removed.removed.map((entry) => entry.name)).toEqual(["a.md"])
		expect(treeShape(index.getRoots())).toEqual([{ Projects: ["b.md"] }])
	})

	it("removes a folder subtree in one change", () => {
		const index = new VaultIndex(ROOT, [
			dir("Projects"),
			dir("Projects/Cortex"),
			file("Projects/Cortex/Roadmap.md"),
			file("Projects/a.md"),
			file("Inbox.md"),
		])
		const delta = index.apply([{ kind: "remove", path: `${ROOT}/Projects` }])
		expect(delta.removed).toHaveLength(4)
		expect(index.has(`${ROOT}/Projects/Cortex/Roadmap.md`)).toBe(false)
		expect(index.getFiles().map((entry) => entry.name)).toEqual(["Inbox.md"])
	})

	it("renames and moves a folder subtree", () => {
		const index = new VaultIndex(ROOT, [
			dir("Projects"),
			dir("Projects/Cortex"),
			file("Projects/Cortex/Roadmap.md"),
			dir("Archive"),
		])
		index.apply([{ kind: "rename", from: `${ROOT}/Projects/Cortex`, to: `${ROOT}/Archive/Old` }])
		expect(index.has(`${ROOT}/Projects/Cortex`)).toBe(false)
		expect(index.get(`${ROOT}/Archive/Old`)?.name).toBe("Old")
		expect(index.get(`${ROOT}/Archive/Old/Roadmap.md`)?.isDir).toBe(false)
		expect(treeShape(index.getRoots())).toEqual([
			{ Archive: [{ Old: ["Roadmap.md"] }] },
			{ Projects: [] },
		])
	})

	it("reports entries whose parent folder is not indexed yet", () => {
		const index = new VaultIndex(ROOT, [])
		const delta = index.apply([{ kind: "upsert", entry: file("Missing/a.md") }])
		expect(delta.missingParents).toEqual([`${ROOT}/Missing`])
		expect(index.size).toBe(0)
	})

	it("hides database view notes and marks their folders", () => {
		const index = new VaultIndex(ROOT, [
			dir("Meetings"),
			file("Meetings/Meetings.md"),
			file("Meetings/a.md"),
		])
		const before = index.getRoots()[0]
		index.setDatabaseViewNotes([`${ROOT}/Meetings/Meetings.md`])
		const meetings = index.getRoots()[0]
		expect(meetings).not.toBe(before)
		expect(meetings?.isDatabase).toBe(true)
		expect(meetings?.children.map((node) => node.name)).toEqual(["a.md"])
		expect(index.getFiles()).toHaveLength(3)
	})

	it("keeps the files snapshot stable for metadata-only changes", () => {
		const index = new VaultIndex(ROOT, [file("a.md")])
		const files = index.getFiles()
		index.apply([{ kind: "upsert", entry: file("a.md", 9, 9) }])
		expect(index.getFiles()).toBe(files)
		expect(index.getModifiedTime(`${ROOT}/a.md`)).toBe(9000)
		index.apply([{ kind: "upsert", entry: file("b.md") }])
		expect(index.getFiles()).not.toBe(files)
		expect(index.getFiles().map((entry) => entry.mtime)).toEqual([9, 1])
	})

	it("keeps unchanged sibling nodes stable across changes", () => {
		const index = new VaultIndex(ROOT, [dir("A"), file("A/x.md"), dir("B"), file("B/y.md")])
		const [, beforeB] = index.getRoots()
		index.apply([{ kind: "upsert", entry: file("A/z.md") }])
		const [afterA, afterB] = index.getRoots()
		expect(afterB).toBe(beforeB)
		expect(afterA?.children.map((node) => node.name)).toEqual(["x.md", "z.md"])
	})

	it("matches a full rebuild after random change batches", () => {
		let seed = 7
		const random = (limit: number) => {
			seed = (seed * 1103515245 + 12345) % 2147483648
			return seed % limit
		}
		const folders = ["A", "A/B", "C", "C/D", "C/D/E"]
		const live = new Map<string, FileEntry>()
		const index = new VaultIndex(ROOT, [])
		for (let round = 0; round < 60; round++) {
			const changes: VaultIndexChange[] = []
			for (let step = 0; step < 8; step++) {
				const action = random(4)
				const folder = folders[random(folders.length)] ?? "A"
				if (action === 0) {
					for (const part of folder.split("/").map((_, i, all) => all.slice(0, i + 1).join("/"))) {
						const entry = dir(part)
						live.set(entry.path, entry)
						changes.push({ kind: "upsert", entry })
					}
				} else if (action === 1) {
					const parent = `${ROOT}/${folder}`
					if (!live.has(parent)) continue
					const entry = file(`${folder}/n${random(12)}.md`, random(5), random(5))
					live.set(entry.path, entry)
					changes.push({ kind: "upsert", entry })
				} else if (action === 2) {
					const paths = [...live.keys()]
					const target = paths[random(Math.max(paths.length, 1))]
					if (!target) continue
					for (const path of paths) {
						if (path === target || path.startsWith(`${target}/`)) live.delete(path)
					}
					changes.push({ kind: "remove", path: target })
				} else {
					const paths = [...live.values()].filter((entry) => !entry.isDir)
					const target = paths[random(Math.max(paths.length, 1))]
					if (!target) continue
					const entry = { ...target, mtime: (target.mtime ?? 0) + 1 }
					live.set(entry.path, entry)
					changes.push({ kind: "upsert", entry })
				}
			}
			index.apply(changes)
			const rebuilt = new VaultIndex(ROOT, [...live.values()])
			expect(snapshot(index)).toEqual(snapshot(rebuilt))
		}
	})

	it("diffs a full rescan against the current entries", () => {
		const index = new VaultIndex(ROOT, [dir("A"), file("A/x.md"), file("y.md")])
		const delta = index.replaceAll([dir("A"), file("A/x.md", 3, 3), file("z.md")])
		expect(delta.added.map((entry) => entry.name)).toEqual(["z.md"])
		expect(delta.removed.map((entry) => entry.name)).toEqual(["y.md"])
		expect(delta.modified.map((entry) => entry.name)).toEqual(["x.md"])
	})
})
