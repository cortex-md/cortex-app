import { createDefaultSyncPreferences } from "@cortex/platform/sync-rules"
import type { RemoteFileInfo } from "@cortex/sync-api"
import { describe, expect, it } from "vitest"
import { FULL_ACCESS, type SyncAccess } from "../access"
import type { FileState } from "../db"
import { type LocalFileInfo, planFullSync, planRemoteChange } from "../planner"

const preferences = createDefaultSyncPreferences()

function remote(path: string, checksum: string, version = 2): RemoteFileInfo {
	return {
		path,
		checksum,
		version,
		snapshotId: null,
		deleted: false,
		sizeBytes: 1,
		contentType: null,
		createdAt: null,
		updatedAt: null,
		lastModifiedBy: null,
		lastDeviceId: null,
		createdBy: null,
	} as RemoteFileInfo
}

function state(path: string, values: Partial<FileState>): [string, FileState] {
	return [
		path,
		{
			filePath: path,
			localHash: null,
			remoteHash: null,
			ancestorHash: null,
			localMtime: 1,
			localSize: 1,
			syncStatus: "synced",
			serverVersion: 1,
			...values,
		} as FileState,
	]
}

function local(hash: string): LocalFileInfo {
	return { hash, mtime: 1, size: 1 }
}

function plan(
	remoteFiles: RemoteFileInfo[],
	states: Array<[string, FileState]>,
	localFiles: Array<[string, LocalFileInfo]>,
	access: SyncAccess = FULL_ACCESS,
) {
	return planFullSync(remoteFiles, new Map(states), new Map(localFiles), preferences, access)
}

describe("planFullSync", () => {
	it("downloads remote changes when the local file is untouched", () => {
		const result = plan(
			[remote("a.md", "remote")],
			[state("a.md", { localHash: "base", ancestorHash: "base" })],
			[["a.md", local("base")]],
		)

		expect(result.actions).toEqual([{ type: "download", path: "a.md", version: 2 }])
	})

	it("uploads local changes when the remote file is untouched", () => {
		const result = plan(
			[remote("a.md", "base")],
			[state("a.md", { localHash: "base", ancestorHash: "base" })],
			[["a.md", local("edited")]],
		)

		expect(result.actions).toEqual([{ type: "upload", path: "a.md" }])
	})

	it("downloads when both sides changed so the merge happens on download", () => {
		const result = plan(
			[remote("a.md", "remote")],
			[state("a.md", { localHash: "base", ancestorHash: "base" })],
			[["a.md", local("local")]],
		)

		expect(result.actions).toEqual([{ type: "download", path: "a.md", version: 2 }])
	})

	it("propagates a local deletion only when the remote matches the ancestor", () => {
		const untouched = plan([remote("a.md", "base")], [state("a.md", { ancestorHash: "base" })], [])
		const changedRemotely = plan(
			[remote("a.md", "remote")],
			[state("a.md", { ancestorHash: "base" })],
			[],
		)

		expect(untouched.actions).toEqual([{ type: "deleteRemote", path: "a.md" }])
		expect(changedRemotely.actions).toEqual([{ type: "download", path: "a.md", version: 2 }])
	})

	it("deletes local files removed remotely only when they were not edited", () => {
		const result = plan(
			[],
			[state("clean.md", { localHash: "base" }), state("edited.md", { localHash: "base" })],
			[
				["clean.md", local("base")],
				["edited.md", local("edited")],
			],
		)

		expect(result.actions).toEqual([
			{ type: "delete", path: "clean.md" },
			{ type: "upload", path: "edited.md" },
		])
	})

	it("never uploads or deletes remotely without write access", () => {
		const readOnly: SyncAccess = { canRead: () => true, canWrite: () => false }

		const result = plan(
			[remote("a.md", "base"), remote("gone.md", "base")],
			[
				state("a.md", { localHash: "base", ancestorHash: "base" }),
				state("gone.md", { ancestorHash: "base" }),
			],
			[
				["a.md", local("edited")],
				["new.md", local("new")],
			],
			readOnly,
		)

		expect(result.actions).toEqual([
			{ type: "download", path: "a.md", version: 2 },
			{ type: "download", path: "gone.md", version: 2 },
		])
		expect(result.readOnlyLocal).toEqual(["new.md"])
	})

	it("leaves files in conflict untouched", () => {
		const result = plan(
			[remote("a.md", "remote")],
			[state("a.md", { syncStatus: "conflict", ancestorHash: "base" })],
			[["a.md", local("local")]],
		)

		expect(result.actions).toEqual([])
	})

	it("orders downloads and deletes before uploads", () => {
		const result = plan(
			[remote("down.md", "remote")],
			[state("down.md", { localHash: "base", ancestorHash: "base" })],
			[
				["up.md", local("new")],
				["down.md", local("base")],
			],
		)

		expect(result.actions.map((action) => action.type)).toEqual(["download", "upload"])
	})
})

describe("planRemoteChange", () => {
	it("ignores changes produced by this device", () => {
		const change = {
			type: "file_updated",
			path: "a.md",
			version: 3,
			deviceId: "self",
			actorId: "user",
			createdAt: "2026-01-01T00:00:00Z",
		}

		expect(planRemoteChange(change as never, "self", preferences)).toEqual({
			op: null,
			metadata: null,
		})
	})

	it("turns remote renames into a local rename", () => {
		const change = {
			type: "file_renamed",
			path: "new.md",
			oldPath: "old.md",
			version: 3,
			deviceId: "other",
			actorId: "user",
			createdAt: "2026-01-01T00:00:00Z",
		}

		expect(planRemoteChange(change as never, "self", preferences).op).toEqual({
			type: "rename",
			oldPath: "old.md",
			newPath: "new.md",
		})
	})
})
