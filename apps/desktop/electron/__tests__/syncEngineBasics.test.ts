import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
	createDefaultSyncPreferences,
	isSyncImagePath,
	shouldIgnoreSyncPath,
} from "@cortex/platform/sync-rules"
import { toVaultRelativePath } from "@cortex/platform/utils"
import { SyncError } from "@cortex/sync-api"
import {
	configureSyncRuntime,
	mergeMarkdown,
	normalizeRelativePath,
	retryBackoffSecs,
	SyncDb,
	SyncQueue,
} from "@cortex/sync-engine"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { nodeSyncRuntime } from "../platform/nodeSyncRuntime"

const tempDirs: string[] = []

beforeAll(() => configureSyncRuntime(nodeSyncRuntime))

function tempVault(): string {
	const directory = mkdtempSync(join(tmpdir(), "cortex-sync-engine-"))
	tempDirs.push(directory)
	return directory
}

afterEach(() => {
	while (tempDirs.length > 0) {
		const directory = tempDirs.pop()
		if (directory) rmSync(directory, { recursive: true, force: true })
	}
})

describe("paths", () => {
	it("normalizes windows relative paths", () => {
		expect(normalizeRelativePath("Notes\\Plan.md")).toBe("Notes/Plan.md")
	})

	it("derives windows relative paths from logical roots", () => {
		expect(toVaultRelativePath("C:\\Users\\Luiza\\Vault\\Note.md", "C:\\Users\\Luiza\\Vault")).toBe(
			"Note.md",
		)
	})
})

describe("mergeMarkdown", () => {
	it("returns remote when local matches ancestor", () => {
		expect(mergeMarkdown("a", "a", "b")).toEqual({ kind: "clean", content: "b" })
	})
})

describe("sync error classification", () => {
	it("treats http 429 as retriable", () => {
		expect(
			SyncError.fromStatus(429, "Upload failed: HTTP 429: too many requests").isRetriable,
		).toBe(true)
	})

	it("treats auth errors as non-retriable", () => {
		expect(SyncError.fromStatus(401, "Conflict: HTTP 401: cannot retry").isRetriable).toBe(false)
	})
})

describe("ignore patterns", () => {
	it("matches excluded files and directories", () => {
		const preferences = {
			...createDefaultSyncPreferences(),
			excludedPaths: ["private/", "/scratch.md"],
		}
		expect(shouldIgnoreSyncPath("private/note.md", preferences)).toBe(true)
		expect(shouldIgnoreSyncPath("scratch.md", preferences)).toBe(true)
		expect(shouldIgnoreSyncPath("notes/scratch.md", preferences)).toBe(false)
	})

	it("ignores images when configured", () => {
		expect(isSyncImagePath("photo.PNG")).toBe(true)
		const preferences = { ...createDefaultSyncPreferences(), ignoreImages: true }
		expect(shouldIgnoreSyncPath("assets/photo.png", preferences)).toBe(true)
		expect(shouldIgnoreSyncPath("notes/todo.md", preferences)).toBe(false)
	})
})

describe("queue dedup", () => {
	it("deduplicates uploads in memory and sqlite", () => {
		const vault = tempVault()
		const db = new SyncDb(vault)
		const queue = new SyncQueue(db)
		queue.push({ type: "upload", path: "note.md" })
		queue.push({ type: "upload", path: "note.md" })

		expect(queue.size).toBe(1)
		expect(db.listDueQueue(Math.floor(Date.now() / 1000))).toHaveLength(1)
		db.close()
	})

	it("keeps only the latest download version", () => {
		const vault = tempVault()
		const db = new SyncDb(vault)
		const queue = new SyncQueue(db)
		queue.push({ type: "download", path: "note.md", version: 2 })
		queue.push({ type: "download", path: "note.md", version: 1 })
		queue.push({ type: "download", path: "note.md", version: 5 })

		expect(queue.size).toBe(1)
		const item = queue.pop()
		expect(item?.op).toEqual({ type: "download", path: "note.md", version: 5 })
		const rows = db.listDueQueue(Math.floor(Date.now() / 1000))
		expect(rows).toHaveLength(1)
		expect(JSON.parse(rows[0]?.op ?? "{}").version).toBe(5)
		db.close()
	})

	it("deduplicating downloads keeps the highest source event id", () => {
		const vault = tempVault()
		const db = new SyncDb(vault)
		const queue = new SyncQueue(db)
		queue.push({ type: "download", path: "note.md", version: 5 }, "8")
		queue.push({ type: "download", path: "note.md", version: 2 }, "12")

		expect(queue.size).toBe(1)
		const item = queue.pop()
		expect(item?.op).toEqual({ type: "download", path: "note.md", version: 5 })
		expect(item?.sourceEventId).toBe("12")
		db.close()
	})

	it("schedules retries without duplicating pending rows", () => {
		const vault = tempVault()
		const db = new SyncDb(vault)
		const queue = new SyncQueue(db)
		queue.push({ type: "upload", path: "note.md" })
		const item = queue.pop()
		expect(item).toBeTruthy()
		if (!item) return
		queue.fail(item, true)

		const now = Math.floor(Date.now() / 1000)
		expect(db.listDueQueue(now)).toHaveLength(0)
		expect(db.listDueQueue(now + retryBackoffSecs(0) + 1)).toHaveLength(1)

		queue.push({ type: "upload", path: "note.md" })
		expect(queue.size).toBe(1)
		expect(db.listDueQueue(now)).toHaveLength(1)
		db.close()
	})
})
