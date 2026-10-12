import { getBaseName } from "@cortex/core"
import type { ConflictInfo, ConflictResolution } from "@cortex/platform"
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from "@cortex/ui"
import { DiffViewer } from "./DiffViewer"

interface Props {
	conflict: ConflictInfo
	onResolve: (resolution: ConflictResolution) => void
	onClose: () => void
}

export function ConflictDiffView({ conflict, onResolve, onClose }: Props) {
	const hasContent = conflict.localContent !== null && conflict.remoteContent !== null

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="md:max-w-[900px] md:max-h-[600px] flex flex-col gap-0 p-0">
				<DialogTitle className="dialog-chrome-header text-sm font-medium">
					Conflict: {conflict.filePath}
				</DialogTitle>
				<DialogDescription className="sr-only">
					Diff between local and remote versions
				</DialogDescription>

				<div className="flex-1 overflow-auto min-h-0">
					{hasContent ? (
						<DiffViewer
							fileName={getBaseName(conflict.filePath)}
							oldContents={conflict.localContent ?? ""}
							newContents={conflict.remoteContent ?? ""}
							diffStyle="split"
							overflow="wrap"
						/>
					) : (
						<p className="p-4 text-sm text-text-muted">
							No side-by-side view for this file. Edit it to the version you want and choose Keep
							Local, or take the remote copy.
						</p>
					)}
				</div>

				<div className="dialog-chrome-footer flex items-center justify-end gap-2">
					<Button variant="ghost" size="sm" onClick={onClose}>
						Cancel
					</Button>
					<Button variant="secondary" size="sm" onClick={() => onResolve({ type: "keep_local" })}>
						Keep Local
					</Button>
					<Button variant="secondary" size="sm" onClick={() => onResolve({ type: "keep_remote" })}>
						Keep Remote
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
