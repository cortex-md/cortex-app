import type { FileMetadata, FileSnapshot } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { noteCache } from "../noteCache"

const CREATED_NOTE_FINGERPRINT_RETRY_DELAYS_MS = [20, 80]

export function splitFileName(fileName: string): { baseName: string; extension: string } {
	const extensionIndex = fileName.lastIndexOf(".")
	if (extensionIndex <= 0) return { baseName: fileName, extension: "" }
	return {
		baseName: fileName.slice(0, extensionIndex),
		extension: fileName.slice(extensionIndex),
	}
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function pathExists(filePath: string): Promise<boolean> {
	try {
		await getPlatform().fs.getFileMetadata(filePath)
		return true
	} catch {
		return false
	}
}

export async function resolveUniquePath(parentPath: string, fileName: string): Promise<string> {
	const { baseName, extension } = splitFileName(fileName)
	let candidateName = fileName
	let candidatePath = `${parentPath}/${candidateName}`
	let suffix = 2
	while (await pathExists(candidatePath)) {
		candidateName = `${baseName} ${suffix}${extension}`
		candidatePath = `${parentPath}/${candidateName}`
		suffix++
	}
	return candidatePath
}

async function readCreatedNoteFingerprint(filePath: string): Promise<{
	hash: string
	metadata: FileMetadata
}> {
	const platform = getPlatform()
	let lastError: unknown = null
	for (const retryDelay of [0, ...CREATED_NOTE_FINGERPRINT_RETRY_DELAYS_MS]) {
		if (retryDelay > 0) await delay(retryDelay)
		try {
			const [hash, metadata] = await Promise.all([
				platform.fs.hashFile(filePath),
				platform.fs.getFileMetadata(filePath),
			])
			return { hash, metadata }
		} catch (error) {
			lastError = error
		}
	}
	throw lastError
}

async function primeCreatedNote(filePath: string, content: string): Promise<void> {
	try {
		const fingerprint = await readCreatedNoteFingerprint(filePath)
		noteCache.primeClean(filePath, content, fingerprint.hash, {
			localCreated: true,
			metadata: fingerprint.metadata,
		})
	} catch (error) {
		console.error("[Created note fingerprint failed]", { path: filePath, error })
		noteCache.primeClean(filePath, content, `local-created:${Date.now()}:${filePath}`, {
			localCreated: true,
		})
	}
}

function primeCreatedNoteSnapshot(filePath: string, snapshot: FileSnapshot): void {
	noteCache.primeClean(filePath, snapshot.content, snapshot.hash, {
		localCreated: true,
		metadata: snapshot.metadata,
	})
}

export async function writeCleanNote(filePath: string, content: string): Promise<void> {
	const platform = getPlatform()
	if (platform.fs.writeFileSnapshot) {
		try {
			primeCreatedNoteSnapshot(filePath, await platform.fs.writeFileSnapshot(filePath, content))
			return
		} catch (error) {
			console.error("[Created note snapshot write failed]", { path: filePath, error })
		}
	}
	await platform.fs.writeFile(filePath, content)
	await primeCreatedNote(filePath, content)
}
