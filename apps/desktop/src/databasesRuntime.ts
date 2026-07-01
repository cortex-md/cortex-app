import { noteCache } from "@cortex/core"
import { initializeDatabases } from "@cortex/databases"
import { getPlatform } from "@cortex/platform"

export function initializeDesktopDatabases(): void {
	const platform = getPlatform()
	initializeDatabases({
		files: {
			readFile: (path) => platform.fs.readFile(path),
			writeFile: (path, content) => platform.fs.writeFile(path, content),
			atomicWriteFile: (path, content) => platform.fs.atomicWriteFile(path, content),
		},
		notes: {
			readNote: (path) => {
				const entry = noteCache.getEntry(path)
				return entry ? Promise.resolve(entry.content) : platform.fs.readFile(path)
			},
		},
	})
}
