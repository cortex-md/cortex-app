import type { SharedNoteBundle } from "@cortex/platform"

export const SHARED_NOTE_VIEW_ID = "shared-note"

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function rewriteAttachmentLinks(
	bundle: SharedNoteBundle,
	target: (index: number) => string,
): string {
	let markdown = bundle.markdown
	bundle.attachments.forEach((attachment, index) => {
		const path = escapeRegExp(attachment.path)
		const replacement = target(index)
		markdown = markdown
			.replace(new RegExp(`(!\\[[^\\]]*\\]\\()<?${path}>?(\\))`, "g"), `$1<${replacement}>$2`)
			.replace(new RegExp(`!\\[\\[${path}(\\|[^\\]]*)?\\]\\]`, "g"), `![](<${replacement}>)`)
	})
	return markdown
}

export function inlineAttachments(bundle: SharedNoteBundle): string {
	return rewriteAttachmentLinks(bundle, (index) => {
		const attachment = bundle.attachments[index]
		return attachment ? `data:${attachment.type};base64,${attachment.data}` : ""
	})
}
