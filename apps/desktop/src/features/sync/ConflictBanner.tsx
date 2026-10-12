import { toVaultRelativePath, useSyncStore, useVaultStore } from "@cortex/core"
import type { ConflictResolution } from "@cortex/platform"
import { Button } from "@cortex/ui"
import { AlertTriangleIcon } from "lucide-react"
import { lazy, Suspense, useState } from "react"

const LazyConflictDiffView = lazy(() =>
	import("./ConflictDiffView").then((module) => ({ default: module.ConflictDiffView })),
)

interface Props {
	filePath: string
}

export function ConflictBanner({ filePath }: Props) {
	const vault = useVaultStore((s) => s.vault)
	const conflicts = useSyncStore((s) => s.conflicts)
	const resolveConflict = useSyncStore((s) => s.resolveConflict)
	const [showDiff, setShowDiff] = useState(false)

	if (!vault) return null

	const relativePath = toVaultRelativePath(filePath, vault.path) ?? filePath
	const conflict = conflicts[relativePath]

	if (!conflict) return null

	const handleResolve = (resolution: ConflictResolution) => {
		resolveConflict(relativePath, resolution)
		setShowDiff(false)
	}

	return (
		<>
			<div className="flex items-center gap-2 border-b border-status-warning-border bg-status-warning-background px-3 py-1.5 text-xs">
				<AlertTriangleIcon className="size-3.5 flex-shrink-0 text-status-warning-foreground" />
				<span className="font-medium text-status-warning-foreground">
					Conflicting changes detected
				</span>
				<div className="flex items-center gap-1.5 ml-auto">
					<Button variant="ghost" size="xs" onClick={() => handleResolve({ type: "keep_local" })}>
						Keep Local
					</Button>
					<Button variant="ghost" size="xs" onClick={() => handleResolve({ type: "keep_remote" })}>
						Keep Remote
					</Button>
					<Button variant="outline" size="xs" onClick={() => setShowDiff(true)}>
						View Diff
					</Button>
				</div>
			</div>

			{showDiff && (
				<Suspense fallback={null}>
					<LazyConflictDiffView
						conflict={conflict}
						onResolve={handleResolve}
						onClose={() => setShowDiff(false)}
					/>
				</Suspense>
			)}
		</>
	)
}
