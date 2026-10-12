import { useRemoteVaultStore, useSyncStore, useVaultStore } from "@cortex/core"
import type { ConflictResolution } from "@cortex/platform"
import { lazy, Suspense, useEffect } from "react"
import { DeletedNotesPanel } from "./DeletedNotesPanel"
import { SyncLogsModal } from "./SyncLogsModal"
import { deletedNotesModal, syncConflictModal, syncLogsModal } from "./syncDialogStores"

const LazyConflictDiffView = lazy(() =>
	import("./ConflictDiffView").then((module) => ({ default: module.ConflictDiffView })),
)

function closeWhenHidden(close: () => void) {
	return (open: boolean) => {
		if (!open) close()
	}
}

function SyncConflictHost() {
	const target = syncConflictModal.useTarget()
	const conflict = useSyncStore((state) =>
		target ? state.conflicts[target.relativePath] : undefined,
	)

	useEffect(() => {
		if (!target) return
		const vaultPath = useVaultStore.getState().vault?.path
		const vaultId = useRemoteVaultStore.getState().linkedVaultId
		if (vaultPath && vaultId) void useSyncStore.getState().loadConflicts(vaultId, vaultPath)
	}, [target])

	if (!target || !conflict) return null

	const handleResolve = (resolution: ConflictResolution) => {
		void useSyncStore.getState().resolveConflict(target.relativePath, resolution)
		syncConflictModal.close()
	}

	return (
		<Suspense fallback={null}>
			<LazyConflictDiffView
				conflict={conflict}
				onResolve={handleResolve}
				onClose={syncConflictModal.close}
			/>
		</Suspense>
	)
}

export function SyncDialogsHost() {
	const logsOpen = syncLogsModal.useTarget() !== null
	const deletedNotesOpen = deletedNotesModal.useTarget() !== null
	return (
		<>
			<SyncLogsModal open={logsOpen} onOpenChange={closeWhenHidden(syncLogsModal.close)} />
			<DeletedNotesPanel
				open={deletedNotesOpen}
				onOpenChange={closeWhenHidden(deletedNotesModal.close)}
			/>
			<SyncConflictHost />
		</>
	)
}
