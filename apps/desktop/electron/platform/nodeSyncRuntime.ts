import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync } from "node:fs"
import { lstat, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"
import type { SyncFs, SyncRuntime } from "@cortex/sync-engine"
import { nodeCrypto } from "./nodeCrypto"

const nodeSyncFs: SyncFs = {
	readFile: (path) => readFile(path),
	readTextFile: (path) => readFile(path, "utf8"),
	writeFile: (path, content) => writeFile(path, content),
	stat: (path) => stat(path),
	lstat: (path) => lstat(path),
	readdir: (path) => readdir(path, { withFileTypes: true }),
	mkdir: async (path) => {
		await mkdir(path, { recursive: true })
	},
	mkdirSync: (path) => {
		mkdirSync(path, { recursive: true })
	},
	rename: (oldPath, newPath) => rename(oldPath, newPath),
	rm: (path) => rm(path, { force: true }),
	existsSync: (path) => existsSync(path),
}

export const nodeSyncRuntime: SyncRuntime = {
	crypto: nodeCrypto,
	fs: nodeSyncFs,
	path: { join, dirname, resolve, relative, isAbsolute },
	openDatabase: (path) => new DatabaseSync(path),
	randomUUID: () => randomUUID(),
}
