import { useDragStore, useWorkspaceStore } from "@cortex/core"

function titleFromPath(filePath: string): string {
	const name = filePath.split("/").pop() ?? filePath
	return name.endsWith(".md") ? name.slice(0, -3) : name
}

export function DragPreview() {
	const dragSource = useDragStore((s) => s.dragSource)
	const dragPosition = useDragStore((s) => s.dragPosition)
	const panes = useWorkspaceStore((s) => s.panes)

	if (!dragSource || !dragPosition) return null

	const label =
		dragSource.type === "file"
			? titleFromPath(dragSource.filePath)
			: dragSource.type === "sidebar-view"
				? dragSource.viewTitle
				: (Object.values(panes)
						.flatMap((pane) => pane.tabs)
						.find((tab) => tab.id === dragSource.tabId)?.title ?? "Tab")

	return (
		<div
			className="pointer-events-none fixed z-[9999] max-w-[220px] translate-x-3 translate-y-3 rounded-md border border-border/70 bg-popover/95 px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-lg backdrop-blur"
			style={{
				left: dragPosition.x,
				top: dragPosition.y,
			}}
		>
			<span className="block truncate">{label}</span>
		</div>
	)
}
