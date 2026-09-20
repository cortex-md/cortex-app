import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import writeFileAtomic from "write-file-atomic"

export async function atomicWriteBytes(path: string, content: Buffer | Uint8Array): Promise<void> {
	mkdirSync(dirname(path), { recursive: true })
	await writeFileAtomic(path, Buffer.from(content))
}
