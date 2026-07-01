import { noteCache, useWorkspaceStore } from "@cortex/core"
import {
	type DatabaseEmbedMarker,
	parseDatabaseEmbedMarker,
	serializeDatabaseEmbedMarker,
} from "@cortex/databases"
import type { LineEmbedDefinition } from "@cortex/editor/line-embeds"
import { projectRawNote, replaceFrontmatterBody } from "@cortex/properties"
import { createRoot, type Root } from "react-dom/client"
import { DatabaseEmbedSurface } from "./DatabaseEmbedSurface"

function markFileTabsDirty(filePath: string): void {
	const workspace = useWorkspaceStore.getState()
	for (const pane of Object.values(workspace.panes)) {
		for (const tab of pane.tabs) {
			if (tab.filePath === filePath) workspace.markTabDirty(tab.id, true)
		}
	}
}

function replaceBodyRange(body: string, from: number, to: number, replacement: string): string {
	const preservesTrailingNewline = to > from && body[to - 1] === "\n"
	return `${body.slice(0, from)}${replacement}${preservesTrailingNewline ? "\n" : ""}${body.slice(to)}`
}

async function updateDatabaseEmbedMarker(
	filePath: string,
	sourceFrom: number,
	sourceTo: number,
	marker: DatabaseEmbedMarker,
	nextViewId: string,
): Promise<void> {
	const entry = await noteCache.readEntry(filePath)
	const projection = projectRawNote(entry.content)
	const nextMarker = serializeDatabaseEmbedMarker({
		databaseId: marker.databaseId,
		viewId: nextViewId,
	})
	const nextBody = replaceBodyRange(projection.body, sourceFrom, sourceTo, nextMarker)
	const nextRawContent = replaceFrontmatterBody(projection.rawContent, nextBody)
	noteCache.writeExternal(filePath, nextRawContent)
	markFileTabsDirty(filePath)
}

function renderDatabaseEmbed(
	filePath: string,
	marker: DatabaseEmbedMarker,
	sourceFrom: number,
	sourceTo: number,
) {
	return (
		<DatabaseEmbedSurface
			databaseId={marker.databaseId}
			viewId={marker.viewId}
			hostFilePath={filePath}
			onViewChange={(nextViewId) => {
				void updateDatabaseEmbedMarker(filePath, sourceFrom, sourceTo, marker, nextViewId)
			}}
		/>
	)
}

export function createDatabaseLineEmbeds(filePath: string): LineEmbedDefinition[] {
	return [
		{
			id: "database",
			parse: parseDatabaseEmbedMarker,
			render: ({ data, sourceFrom, sourceTo }) => {
				const marker = data as DatabaseEmbedMarker
				return renderDatabaseEmbed(filePath, marker, sourceFrom, sourceTo)
			},
			renderLivePreview: ({ data, sourceFrom, sourceTo }) => {
				const marker = data as DatabaseEmbedMarker
				return {
					title: "Database",
					className: "is-database-embed",
					signature: `${marker.databaseId}:${marker.viewId}:${sourceFrom}:${sourceTo}`,
					mount: (container) => {
						let root: Root | null = createRoot(container)
						root.render(renderDatabaseEmbed(filePath, marker, sourceFrom, sourceTo))
						return () => {
							root?.unmount()
							root = null
						}
					},
				}
			},
		},
	]
}
