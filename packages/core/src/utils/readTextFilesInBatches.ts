import type { TextFileRead } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"

const INDEX_READ_BATCH_SIZE = 200

export async function readTextFilesInBatches(
	paths: readonly string[],
	batchSize = INDEX_READ_BATCH_SIZE,
): Promise<(TextFileRead | null)[]> {
	const platform = getPlatform()
	const reads: (TextFileRead | null)[] = []
	for (let start = 0; start < paths.length; start += batchSize) {
		const batch = paths.slice(start, start + batchSize)
		reads.push(...(await platform.fs.readTextFiles(batch)))
	}
	return reads
}
