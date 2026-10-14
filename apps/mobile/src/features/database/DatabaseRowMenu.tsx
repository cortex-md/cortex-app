import type { DatabaseRow } from "@cortex/properties/database"
import type { Href } from "expo-router"
import type { ReactElement } from "react"
import { Alert, Platform } from "react-native"

import { openNote } from "@/features/navigation/routes"
import { RowContextMenu } from "@/features/search/RowContextMenu"

const IS_IOS = Platform.OS === "ios"

export interface DatabaseRowHandlers {
	onLongPress?: () => void
	onPress?: () => void
}

function showAndroidRowActions(row: DatabaseRow, onPreview: () => void): void {
	Alert.alert(row.title, undefined, [
		{ style: "cancel", text: "Cancel" },
		{ onPress: onPreview, text: "Preview" },
		{ onPress: () => openNote(row.path), text: "Open note" },
	])
}

export function DatabaseRowMenu({
	children,
	onOpenRow,
	row,
}: {
	children: (handlers: DatabaseRowHandlers) => ReactElement
	onOpenRow: (row: DatabaseRow) => void
	row: DatabaseRow
}) {
	const preview = () => onOpenRow(row)
	return (
		<RowContextMenu
			entries={[
				{
					icon: "rectangle.bottomhalf.inset.filled",
					key: "preview",
					label: "Preview",
					onPress: preview,
				},
				{
					icon: "arrow.up.right.square",
					key: "open",
					label: "Open note",
					onPress: () => openNote(row.path),
				},
			]}
			href={{ params: { filePath: row.path }, pathname: "/note" } as Href}
			onPress={preview}
		>
			{(onPress) =>
				children(
					IS_IOS
						? { onPress }
						: { onLongPress: () => showAndroidRowActions(row, preview), onPress },
				)
			}
		</RowContextMenu>
	)
}
