import { readFile } from "node:fs/promises"
import type { ConflictInfo } from "@cortex/platform"
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
import { resolveInVault } from "./util"

export type AutoMergeResult =
	| { kind: "merged"; content: Buffer }
	| { kind: "conflict"; content: Buffer }

function conflict(local: string, remote: string): AutoMergeResult {
	return { kind: "conflict", content: Buffer.from(conflictMarkers(local, remote), "utf8") }
}

export async function attemptAutoMerge(
	path: string,
	local: Buffer,
	remote: Buffer,
	loadAncestor: () => Promise<Buffer | null>,
): Promise<AutoMergeResult> {
	if (!isMergeableText(path)) return { kind: "merged", content: local }

	const localText = local.toString("utf8")
	const remoteText = remote.toString("utf8")
	const ancestor = await loadAncestor()
	if (ancestor === null) return conflict(localText, remoteText)
	const ancestorText = ancestor.toString("utf8")

	if (isMarkdown(path)) {
		const result = mergeMarkdown(ancestorText, localText, remoteText)
		const content = Buffer.from(result.content, "utf8")
		return result.kind === "clean" ? { kind: "merged", content } : { kind: "conflict", content }
	}

	try {
		const result = mergeJson(ancestorText, localText, remoteText)
		return { kind: "merged", content: Buffer.from(result.content, "utf8") }
	} catch {
		return conflict(localText, remoteText)
	}
}

async function readText(vaultPath: string, path: string): Promise<string | null> {
	try {
		return await readFile(resolveInVault(vaultPath, path), "utf8")
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
