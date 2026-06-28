export interface FileEntry {
	path: string
	name: string
	isDir: boolean
	size?: number
	mtime?: number
}

export interface FileMetadata {
	createdAt: number
	modifiedAt: number
}

export interface FileSnapshot {
	content: string
	hash: string
	metadata: FileMetadata
}

export interface WatchEvent {
	path: string
	kind: "created" | "modified" | "deleted" | "renamed"
	watcherId?: string
}

export interface WatchOptions {
	includeHidden?: boolean
	followSymlinks?: boolean
}

export interface FileSystem {
	readFile(path: string): Promise<string>
	readFileSnapshot(path: string): Promise<FileSnapshot>
	writeFile(path: string, content: string): Promise<void>
	atomicWriteFile(path: string, content: string): Promise<void>
	writeBinaryFile(path: string, data: number[]): Promise<void>
	deleteFile(path: string): Promise<void>
	renameFile(oldPath: string, newPath: string): Promise<void>
	createDir(path: string): Promise<void>
	listDir(path: string): Promise<FileEntry[]>
	hashFile(path: string): Promise<string>
	getFileMetadata(path: string): Promise<FileMetadata>
	startWatching(
		path: string,
		callback: (event: WatchEvent) => void,
		options?: WatchOptions,
	): Promise<() => void>
	downloadFile(url: string, destPath: string): Promise<void>
	downloadAndExtract(url: string, destDir: string): Promise<void>
}
