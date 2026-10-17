import {
	getBaseName,
	getParentPath,
	isMarkdownPath,
	toVaultRelativePath,
	useDatabaseStore,
	useVaultStore,
} from "@cortex/core"
import { getPropertiesRuntime, projectRawNote } from "@cortex/properties"
import { DATABASE_CONFIG_KEY } from "@cortex/properties/database"
import { useEffect, useMemo, useState } from "react"

const MAX_FOLDERS = 8
const MAX_SCANNED_NOTES = 20
const PREVIEW_ROWS = 3

export interface FolderCandidate {
	path: string
	label: string
	name: string
	noteCount: number
	notePaths: string[]
}

export interface FolderScan {
	keys: string[]
	samples: { title: string; meta: Record<string, unknown> }[]
}

export function useFolderCandidates(): FolderCandidate[] {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const files = useVaultStore((state) => state.files)
	const databases = useDatabaseStore((state) => state.databases)
	return useMemo(() => {
		if (!vaultPath) return []
		const notes = new Map<string, string[]>()
		for (const file of files) {
			if (file.isDir || !isMarkdownPath(file.path)) continue
			const parent = getParentPath(file.path)
			if (parent === vaultPath || databases[parent]) continue
			const list = notes.get(parent) ?? []
			list.push(file.path)
			notes.set(parent, list)
		}
		return [...notes.entries()]
			.map(([path, notePaths]) => ({
				label: toVaultRelativePath(path, vaultPath) ?? path,
				name: getBaseName(path),
				noteCount: notePaths.length,
				notePaths,
				path,
			}))
			.sort(
				(left, right) => right.noteCount - left.noteCount || left.label.localeCompare(right.label),
			)
			.slice(0, MAX_FOLDERS)
	}, [databases, files, vaultPath])
}

async function scanFolder(candidate: FolderCandidate): Promise<FolderScan> {
	const notes = await Promise.all(
		candidate.notePaths.slice(0, MAX_SCANNED_NOTES).map(async (path) => {
			try {
				const raw = await getPropertiesRuntime().notes.readNote(path)
				return { meta: projectRawNote(raw).meta, title: getBaseName(path).replace(/\.md$/iu, "") }
			} catch {
				return { meta: {}, title: getBaseName(path).replace(/\.md$/iu, "") }
			}
		}),
	)
	const counts = new Map<string, number>()
	for (const note of notes) {
		for (const key of Object.keys(note.meta)) {
			if (key === DATABASE_CONFIG_KEY) continue
			counts.set(key, (counts.get(key) ?? 0) + 1)
		}
	}
	const keys = [...counts.entries()]
		.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
		.map(([key]) => key)
	return { keys, samples: notes.slice(0, PREVIEW_ROWS) }
}

export function useFolderScans(
	candidates: FolderCandidate[],
	enabled: boolean,
): ReadonlyMap<string, FolderScan> {
	const [scans, setScans] = useState<ReadonlyMap<string, FolderScan>>(() => new Map())

	useEffect(() => {
		if (!enabled || candidates.length === 0) return
		let cancelled = false
		void Promise.all(
			candidates.map(async (candidate) => [candidate.path, await scanFolder(candidate)] as const),
		).then((entries) => {
			if (!cancelled) setScans(new Map(entries))
		})
		return () => {
			cancelled = true
		}
	}, [candidates, enabled])

	return scans
}
