import {
	ATTACHMENT_BUDGET_BYTES,
	buildSharedNoteBundle as buildBundle,
	isSharedNoteExternalSource as isExternalSource,
	readSharedNoteImage as readImage,
	sharedNoteBytesToBase64 as toBase64,
} from "@cortex/core"
import type { SharedNoteAttachment, SharedNoteBundle } from "@cortex/platform"

async function embedImages(html: string, notePath: string, vaultPath: string) {
	const document = new DOMParser().parseFromString(html, "text/html")
	const attachments: SharedNoteAttachment[] = []
	const indexBySource = new Map<string, number>()
	let budget = ATTACHMENT_BUDGET_BYTES

	for (const image of document.querySelectorAll("img")) {
		const source = image.getAttribute("src")
		if (!source || isExternalSource(source)) continue
		let index = indexBySource.get(source)
		if (index === undefined) {
			const file = await readImage(source, notePath, vaultPath)
			if (!file || file.bytes.length > budget) {
				image.removeAttribute("src")
				continue
			}
			budget -= file.bytes.length
			index = attachments.push({ path: source, type: file.type, data: toBase64(file.bytes) }) - 1
			indexBySource.set(source, index)
		}
		image.setAttribute("src", `cortex-attachment:${index}`)
	}
	return { html: document.body.innerHTML, attachments }
}

export async function buildSharedNoteBundle(notePath: string): Promise<SharedNoteBundle> {
	return await buildBundle(notePath, {
		render: async (markdown) => {
			const { createRenderer } = await import("@cortex/renderer/pipeline")
			return await createRenderer({ surface: "export" }).render(markdown)
		},
		embedImages,
	})
}
