import { lazy, Suspense } from "react"

export interface DiffViewerFiles {
	fileName: string
	oldContents: string
	newContents: string
}

export interface DiffViewerProps extends DiffViewerFiles {
	diffStyle: "split" | "unified"
	overflow: "wrap" | "scroll"
}

const loadDiffViewerContent = () => import("./DiffViewerContent")

const LazyDiffViewerContent = lazy(() =>
	loadDiffViewerContent().then((module) => ({ default: module.DiffViewerContent })),
)

const LazyDiffStatsContent = lazy(() =>
	loadDiffViewerContent().then((module) => ({ default: module.DiffStatsContent })),
)

export function DiffViewer(props: DiffViewerProps) {
	return (
		<Suspense fallback={null}>
			<LazyDiffViewerContent {...props} />
		</Suspense>
	)
}

export function DiffStats(props: DiffViewerFiles) {
	return (
		<Suspense fallback={null}>
			<LazyDiffStatsContent {...props} />
		</Suspense>
	)
}
