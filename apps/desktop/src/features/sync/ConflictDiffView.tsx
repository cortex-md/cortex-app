import type { ConflictInfo, ConflictResolution } from "@cortex/platform"
import { getThemeManager } from "@cortex/theme"
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from "@cortex/ui"
import { parseDiffFromFile } from "@pierre/diffs"
import { FileDiff } from "@pierre/diffs/react"
import { useEffect, useMemo, useState } from "react"

function useIsDarkTheme(): boolean {
	const [isDark, setIsDark] = useState(() => getThemeManager().getActiveTheme().isDark)
	useEffect(() => {
		return getThemeManager().subscribe((theme) => setIsDark(theme.isDark))
	}, [])
	return isDark
}

interface Props {
	conflict: ConflictInfo
	onResolve: (resolution: ConflictResolution) => void
	onClose: () => void
}

export function ConflictDiffView({ conflict, onResolve, onClose }: Props) {
	const isDark = useIsDarkTheme()
	const hasContent = conflict.localContent !== null && conflict.remoteContent !== null
	const conflictFileName = conflict.filePath.split("/").pop() ?? conflict.filePath

	const fileDiff = useMemo(() => {
		if (!hasContent) return null
		return parseDiffFromFile(
			{ name: conflictFileName, contents: conflict.localContent ?? "" },
			{ name: conflictFileName, contents: conflict.remoteContent ?? "" },
		)
	}, [hasContent, conflictFileName, conflict.localContent, conflict.remoteContent])

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
					{hasContent && fileDiff ? (
						<FileDiff
							fileDiff={fileDiff}
							options={{
								theme: { dark: "pierre-dark", light: "pierre-light" },
								themeType: isDark ? "dark" : "light",
								diffStyle: "split",
								lineDiffType: "word",
								disableFileHeader: true,
								overflow: "wrap",
							}}
						/>
					) : (
						<p className="p-4 text-sm text-text-muted">(binary or unavailable)</p>
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
					{hasContent && (
						<Button
							variant="default"
							size="sm"
							onClick={() => onResolve({ type: "merged", content: conflict.localContent ?? "" })}
						>
							Keep Local as Merged
						</Button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}
