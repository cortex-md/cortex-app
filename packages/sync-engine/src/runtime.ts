import type { CryptoPrimitives } from "@cortex/platform"

export interface SyncFileStats {
	size: number
	mtimeMs: number
	isFile(): boolean
}

export interface SyncDirEntry {
	name: string
	isFile(): boolean
	isDirectory(): boolean
	isSymbolicLink(): boolean
}

export interface SyncFs {
	readFile(path: string): Promise<Uint8Array>
	readTextFile(path: string): Promise<string>
	writeFile(path: string, content: Uint8Array): Promise<void>
	stat(path: string): Promise<SyncFileStats>
	lstat(path: string): Promise<SyncFileStats>
	readdir(path: string): Promise<SyncDirEntry[]>
	mkdir(path: string): Promise<void>
	mkdirSync(path: string): void
	rename(oldPath: string, newPath: string): Promise<void>
	rm(path: string): Promise<void>
	existsSync(path: string): boolean
}

export interface SyncPath {
	join(...parts: string[]): string
	dirname(path: string): string
	resolve(...parts: string[]): string
	relative(from: string, to: string): string
	isAbsolute(path: string): boolean
}

export type SqlValue = null | number | bigint | string | Uint8Array

export interface SqlStatement {
	run(...params: SqlValue[]): unknown
	get(...params: SqlValue[]): unknown
	all(...params: SqlValue[]): unknown[]
}

export interface SqlDatabase {
	readonly isOpen: boolean
	exec(sql: string): void
	prepare(sql: string): SqlStatement
	close(): void
}

export interface SyncRuntime {
	crypto: CryptoPrimitives
	fs: SyncFs
	path: SyncPath
	openDatabase(path: string): SqlDatabase
	randomUUID(): string
}

let current: SyncRuntime | null = null

export function configureSyncRuntime(runtime: SyncRuntime): void {
	current = runtime
}

export function syncRuntime(): SyncRuntime {
	if (!current) throw new Error("Sync runtime is not configured")
	return current
}

export function isNotFoundError(error: unknown): boolean {
	return (error as { code?: unknown } | null)?.code === "ENOENT"
}
