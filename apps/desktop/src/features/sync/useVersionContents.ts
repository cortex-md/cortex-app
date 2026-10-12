import {
	countWordChanges,
	useRemoteVaultStore,
	useSyncStore,
	useVaultStore,
	type WordChangeCount,
} from "@cortex/core"
import type { VersionInfo } from "@cortex/platform"
import { mapWithConcurrency } from "@cortex/platform/utils"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

const PREFETCH_LIMIT = 30
const PREFETCH_CONCURRENCY = 2

export interface VersionContents {
	contents: Record<number, string>
	deltas: Record<number, WordChangeCount>
	loadContent: (version: number) => Promise<string>
}

export function useVersionContents(
	versions: readonly VersionInfo[] | null,
	relativePath: string,
): VersionContents {
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const linkedVaultId = useRemoteVaultStore((state) => state.linkedVaultId)
	const [contents, setContents] = useState<Record<number, string>>({})
	const requests = useRef(new Map<number, Promise<string>>())
	const deltaCache = useRef(new Map<string, WordChangeCount>())

	const loadContent = useCallback(
		(version: number): Promise<string> => {
			const pending = requests.current.get(version)
			if (pending) return pending
			if (!vaultPath || !linkedVaultId) return Promise.reject(new Error("Vault is not linked"))
			const request = useSyncStore
				.getState()
				.downloadVersion(linkedVaultId, vaultPath, relativePath, String(version))
				.then((content) => {
					setContents((current) => ({ ...current, [version]: content }))
					return content
				})
			request.catch(() => requests.current.delete(version))
			requests.current.set(version, request)
			return request
		},
		[vaultPath, linkedVaultId, relativePath],
	)

	useEffect(() => {
		if (!versions || versions.length === 0) return
		const targets = versions.slice(0, PREFETCH_LIMIT + 1)
		void mapWithConcurrency(targets, PREFETCH_CONCURRENCY, (version) =>
			loadContent(version.version).catch(() => undefined),
		)
	}, [versions, loadContent])

	const deltas = useMemo(() => {
		const result: Record<number, WordChangeCount> = {}
		if (!versions) return result
		for (const [index, version] of versions.slice(0, PREFETCH_LIMIT).entries()) {
			const previous = versions[index + 1]
			const after = contents[version.version]
			const before = previous ? contents[previous.version] : ""
			if (after === undefined || before === undefined) continue
			const key = `${version.snapshotId}:${previous?.snapshotId ?? "start"}`
			let delta = deltaCache.current.get(key)
			if (!delta) {
				delta = countWordChanges(before, after)
				deltaCache.current.set(key, delta)
			}
			result[version.version] = delta
		}
		return result
	}, [versions, contents])

	return { contents, deltas, loadContent }
}
