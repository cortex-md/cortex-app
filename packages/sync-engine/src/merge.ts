import DiffMatchPatch from "diff-match-patch"

export type MergeResult =
	| { kind: "clean"; content: string }
	| { kind: "conflicts"; content: string }

interface Hunk {
	start: number
	end: number
	lines: string[]
	side: "local" | "remote"
}

const LOCAL_MARKER = "<<<<<<< LOCAL\n"
const SEPARATOR_MARKER = "=======\n"
const REMOTE_MARKER = ">>>>>>> REMOTE\n"

const dmp = new DiffMatchPatch()

function splitLines(text: string): string[] {
	const lines: string[] = []
	let start = 0
	let newline = text.indexOf("\n")
	while (newline >= 0) {
		lines.push(text.slice(start, newline + 1))
		start = newline + 1
		newline = text.indexOf("\n", start)
	}
	if (start < text.length) lines.push(text.slice(start))
	return lines
}

function diffHunks(ancestor: string, changed: string, side: Hunk["side"]): Hunk[] {
	const { chars1, chars2, lineArray } = dmp.diff_linesToChars_(ancestor, changed)
	const hunks: Hunk[] = []
	let position = 0
	let current: Hunk | null = null
	for (const [operation, chars] of dmp.diff_main(chars1, chars2, false)) {
		if (operation === DiffMatchPatch.DIFF_EQUAL) {
			if (current) hunks.push(current)
			current = null
			position += chars.length
			continue
		}
		current ??= { start: position, end: position, lines: [], side }
		if (operation === DiffMatchPatch.DIFF_DELETE) {
			position += chars.length
			current.end = position
		} else {
			for (let offset = 0; offset < chars.length; offset += 1) {
				current.lines.push(lineArray[chars.charCodeAt(offset)] ?? "")
			}
		}
	}
	if (current) hunks.push(current)
	return hunks
}

function overlaps(hunk: Hunk, start: number, end: number): boolean {
	if (hunk.start < end && start < hunk.end) return true
	return hunk.start === hunk.end && start === end && hunk.start === start
}

function applyHunks(base: string[], start: number, end: number, hunks: Hunk[]): string {
	let position = start
	let text = ""
	for (const hunk of hunks) {
		text += base.slice(position, hunk.start).join("") + hunk.lines.join("")
		position = hunk.end
	}
	return text + base.slice(position, end).join("")
}

function withTrailingNewline(text: string): string {
	return text === "" || text.endsWith("\n") ? text : `${text}\n`
}

export function conflictMarkers(local: string, remote: string): string {
	return `${LOCAL_MARKER}${withTrailingNewline(local)}${SEPARATOR_MARKER}${withTrailingNewline(remote)}${REMOTE_MARKER}`
}

export function mergeMarkdown(ancestor: string, local: string, remote: string): MergeResult {
	if (local === remote || remote === ancestor) return { kind: "clean", content: local }
	if (local === ancestor) return { kind: "clean", content: remote }

	const base = splitLines(ancestor)
	const hunks = [...diffHunks(ancestor, local, "local"), ...diffHunks(ancestor, remote, "remote")]
	hunks.sort((left, right) => left.start - right.start || left.end - right.end)

	let content = ""
	let position = 0
	let conflicted = false
	let index = 0
	while (index < hunks.length) {
		const first = hunks[index] as Hunk
		const group = [first]
		let end = first.end
		index += 1
		while (index < hunks.length && overlaps(hunks[index] as Hunk, first.start, end)) {
			const next = hunks[index] as Hunk
			group.push(next)
			end = Math.max(end, next.end)
			index += 1
		}

		content += base.slice(position, first.start).join("")
		position = end
		const localHunks = group.filter((hunk) => hunk.side === "local")
		const remoteHunks = group.filter((hunk) => hunk.side === "remote")
		const localText = applyHunks(base, first.start, end, localHunks)
		if (localHunks.length === 0 || remoteHunks.length === 0) {
			content +=
				localHunks.length === 0 ? applyHunks(base, first.start, end, remoteHunks) : localText
			continue
		}
		const remoteText = applyHunks(base, first.start, end, remoteHunks)
		if (localText === remoteText) {
			content += localText
			continue
		}
		conflicted = true
		content = withTrailingNewline(content) + conflictMarkers(localText, remoteText)
	}
	content += base.slice(position).join("")
	return { kind: conflicted ? "conflicts" : "clean", content }
}

export type ConflictSide = "local" | "remote"

export function hasConflictMarkers(text: string): boolean {
	return splitLines(text).some(
		(line) => (line.endsWith("\n") ? line : `${line}\n`) === LOCAL_MARKER,
	)
}

export function takeConflictSide(text: string, side: ConflictSide): string {
	let result = ""
	let section: "outside" | ConflictSide = "outside"
	for (const line of splitLines(text)) {
		const marker = line.endsWith("\n") ? line : `${line}\n`
		if (section === "outside" && marker === LOCAL_MARKER) section = "local"
		else if (section === "local" && marker === SEPARATOR_MARKER) section = "remote"
		else if (section === "remote" && marker === REMOTE_MARKER) section = "outside"
		else if (section === "outside" || section === side) result += line
	}
	return section === "outside" ? result : text
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

export function isMergeableText(path: string): boolean {
	return isMarkdown(path) || isJsonConfig(path)
}
