import { getPropertiesRuntime, projectRawNote } from "@cortex/properties"
import { toggleTaskLine } from "@cortex/tasks"
import { useCallback, useEffect, useMemo, useState } from "react"

const TASK_LINE = /^\s*[-*+]\s+\[( |x|X)\]/u

function frontmatterEnd(lines: string[]): number {
	if (lines[0]?.trim() !== "---") return 0
	const close = lines.findIndex((line, index) => index > 0 && line.trim() === "---")
	return close === -1 ? 0 : close + 1
}

function toggleTaskAt(raw: string, taskIndex: number, today: string): string {
	const lines = raw.split("\n")
	let seen = 0
	for (let index = frontmatterEnd(lines); index < lines.length; index++) {
		if (!TASK_LINE.test(lines[index])) continue
		if (seen++ !== taskIndex) continue
		lines[index] = toggleTaskLine(lines[index], today).line
		break
	}
	return lines.join("\n")
}

async function toggleRowTask(path: string, taskIndex: number, today: string): Promise<string> {
	let next = ""
	await getPropertiesRuntime().notes.updateNote(path, (raw) => {
		next = toggleTaskAt(raw, taskIndex, today)
		return next
	})
	return next
}

interface LoadedNote {
	path: string
	mtime: number
	raw: string
}

export function useRowNote(path: string, mtime: number, today: string) {
	const [loaded, setLoaded] = useState<LoadedNote | null>(null)

	useEffect(() => {
		if (!path) return
		let cancelled = false
		void getPropertiesRuntime()
			.notes.readNote(path)
			.then(
				(raw) => {
					if (!cancelled) setLoaded({ mtime, path, raw })
				},
				() => {
					if (!cancelled) setLoaded({ mtime, path, raw: "" })
				},
			)
		return () => {
			cancelled = true
		}
	}, [mtime, path])

	const toggleTask = useCallback(
		(taskIndex: number) => {
			void toggleRowTask(path, taskIndex, today).then(
				(raw) => setLoaded({ mtime, path, raw }),
				() => undefined,
			)
		},
		[mtime, path, today],
	)

	const raw = loaded?.path === path ? loaded.raw : null
	const body = useMemo(() => (raw === null ? null : projectRawNote(raw).body), [raw])
	return { body, toggleTask }
}
