import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { SyncDb } from "../db"
import { defaultSyncPreferences, isImagePath, shouldIgnorePath } from "../ignore"
import { mergeMarkdown } from "../merge"
import { normalizeRelativePath, toVaultRelativePath } from "../paths"
import { retryBackoffSecs, SyncQueue } from "../queue"
import { isRetriableSyncErrorMessage } from "../state"

const tempDirs: string[] = []

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
		expect(toVaultRelativePath("C:\\Users\\Luiza\\Vault", "C:\\Users\\Luiza\\Vault\\Note.md")).toBe(
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
		expect(isRetriableSyncErrorMessage("Upload failed: HTTP 429: too many requests")).toBe(true)
	})

	it("treats auth errors as non-retriable", () => {
		expect(isRetriableSyncErrorMessage("Conflict: HTTP 401: cannot retry")).toBe(false)
	})
})

describe("ignore patterns", () => {
	it("matches excluded files and directories", () => {
		const preferences = {
			...defaultSyncPreferences(),
			excludedPaths: ["private/", "scratch.md"],
		}
		expect(shouldIgnorePath("private/note.md", preferences)).toBe(true)
		expect(shouldIgnorePath("scratch.md", preferences)).toBe(true)
		expect(shouldIgnorePath("notes/scratch.md", preferences)).toBe(false)
	})

	it("ignores images when configured", () => {
		expect(isImagePath("photo.PNG")).toBe(true)
		const preferences = { ...defaultSyncPreferences(), ignoreImages: true }
		expect(shouldIgnorePath("assets/photo.png", preferences)).toBe(true)
		expect(shouldIgnorePath("notes/todo.md", preferences)).toBe(false)
	})
})

describe("queue dedup", () => {
	it("deduplicates uploads in memory and sqlite", () => {
		const vault = tempVault()
		const db = SyncDb.open(vault)
		const queue = SyncQueue.withDb(db)
		const [first, priority] = SyncQueue.upload("note.md")
		queue.push(first, priority)
		const [second] = SyncQueue.upload("note.md")
		queue.push(second, priority)

		expect(queue.len()).toBe(1)
		expect(db.loadPendingQueue(Math.floor(Date.now() / 1000))).toHaveLength(1)
		db.close()
	})

	it("keeps only the latest download version", () => {
		const vault = tempVault()
		const db = SyncDb.open(vault)
		const queue = SyncQueue.withDb(db)
		queue.push(...SyncQueue.download("note.md", 2))
		queue.push(...SyncQueue.download("note.md", 1))
		queue.push(...SyncQueue.download("note.md", 5))

		expect(queue.len()).toBe(1)
		const item = queue.pop()
		expect(item?.op).toEqual({ type: "download", path: "note.md", version: 5 })
		const rows = db.loadPendingQueue(Math.floor(Date.now() / 1000))
		expect(rows).toHaveLength(1)
		expect(rows[0]?.extraData).toBe("5")
		db.close()
	})

	it("deduplicating downloads keeps the highest source event id", () => {
		const vault = tempVault()
		const db = SyncDb.open(vault)
		const queue = SyncQueue.withDb(db)
		const [older, priority] = SyncQueue.download("note.md", 5)
		queue.pushFromEvent(older, priority, "8")
		const [stale] = SyncQueue.download("note.md", 2)
		queue.pushFromEvent(stale, priority, "12")

		expect(queue.len()).toBe(1)
		const item = queue.pop()
		expect(item?.op).toEqual({ type: "download", path: "note.md", version: 5 })
		expect(item?.sourceEventId).toBe("12")
		db.close()
	})

	it("keeps a single creation metadata lookup", () => {
		const queue = new SyncQueue()
		queue.push(...SyncQueue.lookupCreationMetadata("note.md"))
		queue.push(...SyncQueue.lookupCreationMetadata("note.md"))
		expect(queue.len()).toBe(1)
	})

	it("schedules retries without duplicating pending rows", () => {
		const vault = tempVault()
		const db = SyncDb.open(vault)
		const queue = SyncQueue.withDb(db)
		queue.push(...SyncQueue.upload("note.md"))
		const item = queue.pop()
		expect(item).toBeTruthy()
		if (!item) return
		queue.markFailed(item, "temporary", true)

		const now = Math.floor(Date.now() / 1000)
		expect(db.loadPendingQueue(now)).toHaveLength(0)
		expect(db.loadPendingQueue(now + retryBackoffSecs(0) + 1)).toHaveLength(1)

		queue.push(...SyncQueue.upload("note.md"))
		expect(queue.len()).toBe(1)
		expect(db.loadPendingQueue(now)).toHaveLength(1)
		db.close()
	})
})
