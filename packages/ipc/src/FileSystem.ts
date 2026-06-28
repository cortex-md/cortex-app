import type {
	FileEntry,
	FileMetadata,
	FileSnapshot,
	FileSystem as IFileSystem,
	WatchEvent,
	WatchOptions,
} from "@cortex/platform"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { normalizeFileEntries, normalizeWatchEvent } from "./path"

export class FileSystem implements IFileSystem {
	async readFile(path: string): Promise<string> {
		return await invoke<string>("read_file", { path })
	}

	async readFileSnapshot(path: string): Promise<FileSnapshot> {
		return await invoke<FileSnapshot>("read_file_snapshot", { path })
	}

	async writeFileSnapshot(path: string, content: string): Promise<FileSnapshot> {
		return await invoke<FileSnapshot>("write_file_snapshot", { path, content })
	}

	async writeFile(path: string, content: string): Promise<void> {
		await invoke<void>("write_file", { path, content })
	}

	async atomicWriteFile(path: string, content: string): Promise<void> {
		await invoke<void>("atomic_write_file", { path, content })
	}

	async writeBinaryFile(path: string, data: number[]): Promise<void> {
		await invoke<void>("write_binary_file", { path, data })
	}

	async deleteFile(path: string): Promise<void> {
		await invoke<void>("delete_file", { path })
	}

	async renameFile(oldPath: string, newPath: string): Promise<void> {
		await invoke<void>("rename_file", { oldPath, newPath })
	}

	async createDir(path: string): Promise<void> {
		await invoke<void>("create_dir", { path })
	}

	async listDir(path: string): Promise<FileEntry[]> {
		const entries = await invoke<FileEntry[]>("list_dir", { path })
		return normalizeFileEntries(entries)
	}

	async hashFile(path: string): Promise<string> {
		return await invoke<string>("hash_file", { path })
	}

	async getFileMetadata(path: string): Promise<FileMetadata> {
		return await invoke<FileMetadata>("get_file_metadata", { path })
	}

	async startWatching(
		path: string,
		callback: (event: WatchEvent) => void,
		options: WatchOptions = {},
	): Promise<() => void> {
		const watcherId = await invoke<string>("start_watching", {
			path,
			includeHidden: options.includeHidden ?? false,
			followSymlinks: options.followSymlinks ?? false,
		})
		const unlisten = await listen<WatchEvent>("vault-file-changed", (e) => {
			if (e.payload.watcherId !== watcherId) return
			callback(normalizeWatchEvent(e.payload))
		})
		return async () => {
			unlisten()
			await invoke<void>("stop_watching", { watcherId })
		}
	}

	async downloadFile(url: string, destPath: string): Promise<void> {
		await invoke<void>("download_file", { url, destPath })
	}

	async downloadAndExtract(url: string, destDir: string): Promise<void> {
		await invoke<void>("download_and_extract", { url, destDir })
	}
}
