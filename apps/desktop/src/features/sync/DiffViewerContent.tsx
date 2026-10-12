import { getThemeManager } from "@cortex/theme"
import { Badge } from "@cortex/ui"
import { type FileDiffMetadata, parseDiffFromFile } from "@pierre/diffs"
import { FileDiff } from "@pierre/diffs/react"
import { useMemo, useSyncExternalStore } from "react"
import type { DiffViewerFiles, DiffViewerProps } from "./DiffViewer"

let cachedDiffKey: readonly [string, string, string] | null = null
let cachedDiff: FileDiffMetadata | null = null

function getFileDiff({ fileName, oldContents, newContents }: DiffViewerFiles): FileDiffMetadata {
	if (
		cachedDiff &&
		cachedDiffKey?.[0] === fileName &&
		cachedDiffKey[1] === oldContents &&
		cachedDiffKey[2] === newContents
	) {
		return cachedDiff
	}
	cachedDiffKey = [fileName, oldContents, newContents]
	cachedDiff = parseDiffFromFile(
		{ name: fileName, contents: oldContents },
		{ name: fileName, contents: newContents },
	)
	return cachedDiff
}

function subscribeTheme(listener: () => void): () => void {
	return getThemeManager().subscribe(listener)
}

function getIsDarkTheme(): boolean {
	return getThemeManager().getActiveTheme().isDark
}

function useIsDarkTheme(): boolean {
	return useSyncExternalStore(subscribeTheme, getIsDarkTheme, getIsDarkTheme)
}

export function DiffViewerContent({
	fileName,
	oldContents,
	newContents,
	diffStyle,
	overflow,
}: DiffViewerProps) {
	const isDark = useIsDarkTheme()
	const fileDiff = useMemo(
		() => getFileDiff({ fileName, oldContents, newContents }),
		[fileName, oldContents, newContents],
	)

	return (
		<FileDiff
			fileDiff={fileDiff}
			options={{
				theme: { dark: "pierre-dark", light: "pierre-light" },
				themeType: isDark ? "dark" : "light",
				diffStyle,
				lineDiffType: "word",
				disableFileHeader: true,
				overflow,
			}}
		/>
	)
}

export function DiffStatsContent({ fileName, oldContents, newContents }: DiffViewerFiles) {
	const { addedLines, removedLines } = useMemo(() => {
		const { hunks } = getFileDiff({ fileName, oldContents, newContents })
		return {
			addedLines: hunks.reduce((sum, hunk) => sum + hunk.additionLines, 0),
			removedLines: hunks.reduce((sum, hunk) => sum + hunk.deletionLines, 0),
		}
	}, [fileName, oldContents, newContents])

	return (
		<div className="flex shrink-0 items-center gap-2">
			<Badge
				variant="outline"
				className="border-status-success-border bg-status-success-background text-status-success-foreground"
			>
				+{addedLines}
			</Badge>
			<Badge
				variant="outline"
				className="border-status-error-border bg-status-error-background text-status-error-foreground"
			>
				-{removedLines}
			</Badge>
		</div>
	)
}
