import type { EditorExtensionFactory, EditorRuntimeView } from "./types"

export type ClipboardImageHandler = (imageBlob: Blob) => Promise<string | null>

export function clipboardImageExtension(
	onImagePaste: ClipboardImageHandler,
): EditorExtensionFactory {
	return (runtime) =>
		runtime.view.EditorView.domEventHandlers({
			paste(event: ClipboardEvent, view: EditorRuntimeView) {
				const items = event.clipboardData?.items
				if (!items) return false

				let imageItem: DataTransferItem | null = null
				for (const item of items) {
					if (item.type.startsWith("image/")) {
						imageItem = item
						break
					}
				}

				if (!imageItem) return false

				const file = imageItem.getAsFile()
				if (!file) return false

				event.preventDefault()

				const cursor = view.state.selection.main.head
				onImagePaste(file).then((markdownText) => {
					if (!markdownText) return
					view.dispatch({
						changes: { from: cursor, insert: markdownText },
					})
				})

				return true
			},
		})
}
