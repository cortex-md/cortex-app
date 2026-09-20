import DiffMatchPatch from "diff-match-patch"

export type MergeResult =
	| { kind: "clean"; content: string }
	| { kind: "conflicts"; content: string }

export function mergeMarkdown(ancestor: string, local: string, remote: string): MergeResult {
	if (local === remote) return { kind: "clean", content: local }
	if (local === ancestor) return { kind: "clean", content: remote }
	if (remote === ancestor) return { kind: "clean", content: local }

	const dmp = new DiffMatchPatch()
	const localPatches = dmp.patch_make(ancestor, local)
	const [mergedLocal, localResults] = dmp.patch_apply(localPatches, ancestor)
	if (localResults.some((applied) => !applied)) {
		return { kind: "conflicts", content: conflictMarkers(local, remote) }
	}

	const remotePatches = dmp.patch_make(ancestor, remote)
	const [merged, remoteResults] = dmp.patch_apply(remotePatches, mergedLocal)
	if (remoteResults.some((applied) => !applied)) {
		return { kind: "conflicts", content: conflictMarkers(local, remote) }
	}

	return { kind: "clean", content: merged }
}

function conflictMarkers(local: string, remote: string): string {
	return `<<<<<<< LOCAL\n${local}\n=======\n${remote}\n>>>>>>> REMOTE\n`
}

export type BinaryWinner = "local" | "remote"

export function mergeBinary(localMtime: number | null, remoteMtime: number | null): BinaryWinner {
	if (localMtime !== null && remoteMtime !== null) {
		return localMtime >= remoteMtime ? "local" : "remote"
	}
	if (localMtime !== null) return "local"
	return "remote"
}

export function mergeJson(ancestor: string, local: string, remote: string): MergeResult {
	const ancestorValue = JSON.parse(ancestor) as unknown
	const localValue = JSON.parse(local) as unknown
	const remoteValue = JSON.parse(remote) as unknown
	const merged = mergeJsonValues(ancestorValue, localValue, remoteValue)
	return { kind: "clean", content: `${JSON.stringify(merged, null, 2)}\n` }
}

function mergeJsonValues(ancestor: unknown, local: unknown, remote: unknown): unknown {
	if (local === remote) return local
	if (deepEqual(local, ancestor)) return remote
	if (deepEqual(remote, ancestor)) return local

	if (isPlainObject(ancestor) && isPlainObject(local) && isPlainObject(remote)) {
		const keys = new Set([...Object.keys(ancestor), ...Object.keys(local), ...Object.keys(remote)])
		const result: Record<string, unknown> = {}
		for (const key of keys) {
			result[key] = mergeJsonValues(
				ancestor[key],
				Object.hasOwn(local, key) ? local[key] : ancestor[key],
				Object.hasOwn(remote, key) ? remote[key] : ancestor[key],
			)
		}
		return result
	}

	return remote
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function deepEqual(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b)
}

export function isMarkdown(path: string): boolean {
	const lower = path.toLowerCase()
	return lower.endsWith(".md") || lower.endsWith(".markdown")
}

export function isJsonConfig(path: string): boolean {
	return path.startsWith(".cortex/") && path.endsWith(".json")
}

export function isBinary(path: string): boolean {
	return !isMarkdown(path) && !isJsonConfig(path)
}
