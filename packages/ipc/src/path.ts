import type {
	ConflictInfo,
	DeletedFileInfo,
	FileEntry,
	SyncConflictEvent,
	SyncFileEvent,
	VaultMetadata,
	VaultRegistryEntry,
	WatchEvent,
} from "@cortex/platform"

interface DisplayPathRecord {
	path: string
	displayPath?: string | null
}

export function normalizeNativePath(path: string): string {
	return path.replaceAll("\\", "/")
}

export function normalizeDisplayPathRecord<T extends DisplayPathRecord>(record: T): T {
	const normalizedPath = normalizeNativePath(record.path)
	if (normalizedPath === record.path) return { ...record, path: normalizedPath }
	return {
		...record,
		path: normalizedPath,
		displayPath: record.displayPath ?? record.path,
	}
}

export function normalizeFileEntry(entry: FileEntry): FileEntry {
	return { ...entry, path: normalizeNativePath(entry.path) }
}

export function normalizeFileEntries(entries: FileEntry[]): FileEntry[] {
	return entries.map(normalizeFileEntry)
}

export function normalizeVaultMetadata(metadata: VaultMetadata): VaultMetadata {
	return normalizeDisplayPathRecord(metadata)
}

export function normalizeVaultRegistryEntry(entry: VaultRegistryEntry): VaultRegistryEntry {
	return normalizeDisplayPathRecord(entry)
}

export function normalizeWatchEvent(event: WatchEvent): WatchEvent {
	return { ...event, path: normalizeNativePath(event.path) }
}

export function normalizeSyncFileEvent(event: SyncFileEvent): SyncFileEvent {
	return { ...event, path: normalizeNativePath(event.path) }
}

export function normalizeSyncConflictEvent(event: SyncConflictEvent): SyncConflictEvent {
	return { ...event, path: normalizeNativePath(event.path) }
}

export function normalizeConflictInfo(conflict: ConflictInfo): ConflictInfo {
	return { ...conflict, filePath: normalizeNativePath(conflict.filePath) }
}

export function normalizeDeletedFileInfo(file: DeletedFileInfo): DeletedFileInfo {
	return { ...file, filePath: normalizeNativePath(file.filePath) }
}
