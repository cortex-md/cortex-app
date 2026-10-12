import { getParentPath, joinPath } from "@cortex/platform/utils"

export type NoteAssetPath = { kind: "url"; value: string } | { kind: "vaultPath"; value: string }

const WEB_URL_PATTERN = /^(?:https?|data|blob):/iu
const URI_SCHEME_PATTERN = /^[a-z][a-z\d+.-]+:/iu

export function resolveNoteAssetPath(src: string, notePath: string): NoteAssetPath {
	if (WEB_URL_PATTERN.test(src)) return { kind: "url", value: src }
	if (src.startsWith("/") || URI_SCHEME_PATTERN.test(src)) return { kind: "vaultPath", value: src }
	return { kind: "vaultPath", value: joinPath(getParentPath(notePath), src) }
}
