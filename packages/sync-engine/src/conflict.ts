import type { ConflictInfo } from "@cortex/platform"
import { utf8Decode, utf8Encode } from "./bytes"
import type { SyncDb } from "./db"
import {
	conflictMarkers,
	hasConflictMarkers,
	isMarkdown,
	isMergeableText,
	mergeJson,
	mergeMarkdown,
	takeConflictSide,
} from "./merge"
import { syncRuntime } from "./runtime"
import { resolveInVault } from "./util"

export type AutoMergeResult =
	| { kind: "merged"; content: Uint8Array }
	| { kind: "conflict"; content: Uint8Array }

function conflict(local: string, remote: string): AutoMergeResult {
	return { kind: "conflict", content: utf8Encode(conflictMarkers(local, remote)) }
}

export async function attemptAutoMerge(
	path: string,
	local: Uint8Array,
	remote: Uint8Array,
	loadAncestor: () => Promise<Uint8Array | null>,
): Promise<AutoMergeResult> {
	if (!isMergeableText(path)) return { kind: "merged", content: local }

	const localText = utf8Decode(local)
	const remoteText = utf8Decode(remote)
	const ancestor = await loadAncestor()
	if (ancestor === null) return conflict(localText, remoteText)
	const ancestorText = utf8Decode(ancestor)

	if (isMarkdown(path)) {
		const result = mergeMarkdown(ancestorText, localText, remoteText)
		const content = utf8Encode(result.content)
		return result.kind === "clean" ? { kind: "merged", content } : { kind: "conflict", content }
	}

	try {
		const result = mergeJson(ancestorText, localText, remoteText)
		return { kind: "merged", content: utf8Encode(result.content) }
	} catch {
		return conflict(localText, remoteText)
	}
}

async function readText(vaultPath: string, path: string): Promise<string | null> {
	try {
		return await syncRuntime().fs.readTextFile(resolveInVault(vaultPath, path))
	} catch {
		return null
	}
}

export async function getAllConflicts(db: SyncDb, vaultPath: string): Promise<ConflictInfo[]> {
	return await Promise.all(
		db.listConflicts().map(async (state) => {
			const text = await readText(vaultPath, state.filePath)
			const marked = text !== null && hasConflictMarkers(text)
			return {
				filePath: state.filePath,
				localHash: state.localHash ?? "",
				remoteHash: state.remoteHash ?? "",
				ancestorHash: state.ancestorHash,
				localContent: marked ? takeConflictSide(text, "local") : text,
				remoteContent: marked ? takeConflictSide(text, "remote") : null,
			}
		}),
	)
}
