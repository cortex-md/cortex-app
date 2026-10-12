import type * as Y from "yjs"

function isHighSurrogate(code: number): boolean {
	return code >= 0xd800 && code <= 0xdbff
}

function isLowSurrogate(code: number): boolean {
	return code >= 0xdc00 && code <= 0xdfff
}

export function applyTextDiff(text: Y.Text, next: string, origin: unknown): boolean {
	const current = text.toString()
	if (current === next) return false
	const shortest = Math.min(current.length, next.length)
	let prefix = 0
	while (prefix < shortest && current.charCodeAt(prefix) === next.charCodeAt(prefix)) prefix++
	if (prefix > 0 && isHighSurrogate(current.charCodeAt(prefix - 1))) prefix--
	let suffix = 0
	while (
		suffix < shortest - prefix &&
		current.charCodeAt(current.length - 1 - suffix) === next.charCodeAt(next.length - 1 - suffix)
	) {
		suffix++
	}
	if (suffix > 0 && isLowSurrogate(current.charCodeAt(current.length - suffix))) suffix--
	const deleteLength = current.length - prefix - suffix
	const insert = next.slice(prefix, next.length - suffix)
	const apply = () => {
		if (deleteLength > 0) text.delete(prefix, deleteLength)
		if (insert.length > 0) text.insert(prefix, insert)
	}
	if (text.doc) text.doc.transact(apply, origin)
	else apply()
	return true
}
