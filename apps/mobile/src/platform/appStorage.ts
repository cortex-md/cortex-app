import { normalizePath } from "@cortex/platform/utils"
import { Directory, File, Paths } from "expo-file-system"

import { MobilePathNotFoundError } from "./errors"
import { isMobileVaultLogicalPath } from "./mobile-vault-paths"

const appDirectoryName = "Cortex"
const vaultRegistryFileName = "vaults.json"
const vaultRootMapFileName = "mobile-vault-roots.json"

function unsupportedPathError(operation: string): Error {
	return new Error(`${operation} is limited to Cortex Mobile app storage or registered vault roots`)
}

export function normalizeUri(uri: string): string {
	return uri.replace(/\/+$/u, "")
}

export function joinUri(parent: string, child: string): string {
	return `${normalizeUri(parent)}/${child}`
}

function getAppDirectory(): Directory {
	return new Directory(Paths.document, appDirectoryName)
}

export function ensureDirectory(directory: Directory): string {
	directory.create({ idempotent: true, intermediates: true })
	return normalizeUri(directory.uri)
}

export function ensureAppDirectory(): string {
	return ensureDirectory(getAppDirectory())
}

export function ensureParentDirectory(path: string): void {
	const normalizedPath = normalizeUri(path)
	const parentPath = normalizedPath.slice(0, normalizedPath.lastIndexOf("/"))
	if (!parentPath) return
	new Directory(parentPath).create({ idempotent: true, intermediates: true })
}

export function getVaultRegistryPath(): string {
	return joinUri(ensureAppDirectory(), vaultRegistryFileName)
}

export function getVaultRootMapPath(): string {
	return joinUri(ensureAppDirectory(), vaultRootMapFileName)
}

export function isAppStoragePath(path: string): boolean {
	const normalizedPath = normalizeUri(path)
	const appDirectory = normalizeUri(getAppDirectory().uri)
	return normalizedPath === appDirectory || normalizedPath.startsWith(`${appDirectory}/`)
}

export function assertInsideAppData(path: string, operation: string): string {
	const normalizedPath = normalizeUri(path)
	if (isAppStoragePath(normalizedPath)) return normalizedPath
	throw unsupportedPathError(operation)
}

export function assertSupportedPath(path: string, operation: string): string {
	const normalizedUri = normalizeUri(path)
	if (isAppStoragePath(normalizedUri)) return normalizedUri

	const normalizedLogicalPath = normalizePath(normalizedUri)
	if (isMobileVaultLogicalPath(normalizedLogicalPath)) return normalizedLogicalPath

	throw unsupportedPathError(operation)
}

export function isActualDirectoryPath(path: string): boolean {
	return Paths.info(path).isDirectory === true
}

export function getExistingAppStorageFile(path: string, operation: string): File {
	const safePath = assertInsideAppData(path, operation)
	const file = new File(safePath)
	if (!file.exists) throw new MobilePathNotFoundError(`File does not exist: ${safePath}`)
	return file
}

export async function readAppStorageText(path: string): Promise<string | null> {
	const file = new File(assertInsideAppData(path, "fs.readFile"))
	return file.exists ? file.text() : null
}

export async function readAppStorageJson<T>(path: string): Promise<T | null> {
	try {
		const text = await readAppStorageText(path)
		return text === null ? null : (JSON.parse(text) as T)
	} catch {
		return null
	}
}

export function writeAppStorageFile(path: string, content: string | Uint8Array): File {
	const safePath = assertInsideAppData(path, "fs.writeFile")
	ensureParentDirectory(safePath)
	const file = new File(safePath)
	file.write(content)
	return file
}

export async function atomicWriteAppStorageFile(path: string, content: string): Promise<void> {
	const safePath = assertInsideAppData(path, "fs.atomicWriteFile")
	const temporaryPath = `${safePath}.tmp-${crypto.randomUUID()}`
	ensureParentDirectory(safePath)
	const temporaryFile = new File(temporaryPath)
	temporaryFile.write(content)
	await temporaryFile.move(new File(safePath), { overwrite: true })
}

export function writeAppStorageJson(path: string, value: unknown): Promise<void> {
	return atomicWriteAppStorageFile(path, JSON.stringify(value, null, 2))
}
