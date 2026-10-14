import {
	ATTACHMENT_BUDGET_BYTES,
	buildSharedNoteBundle as buildBundle,
	isSharedNoteExternalSource,
	readSharedNoteImage,
	sharedNoteBytesToBase64,
} from "@cortex/core"
import type { SharedNoteAttachment, SharedNoteBundle } from "@cortex/platform"

const IMAGE_SOURCE = /(<img\b[^>]*?\bsrc=")([^"]*)(")/giu

function decodeAttribute(value: string): string {
	return value
		.replace(/&amp;/gu, "&")
		.replace(/&quot;/gu, '"')
		.replace(/&#39;/gu, "'")
}

async function embedImages(html: string, notePath: string, vaultPath: string) {
	const attachments: SharedNoteAttachment[] = []
	const indexBySource = new Map<string, number | null>()
	let budget = ATTACHMENT_BUDGET_BYTES

	for (const match of html.matchAll(IMAGE_SOURCE)) {
		const source = decodeAttribute(match[2] ?? "")
		if (!source || isSharedNoteExternalSource(source) || indexBySource.has(source)) continue
		const file = await readSharedNoteImage(source, notePath, vaultPath)
		if (!file || file.bytes.length > budget) {
			indexBySource.set(source, null)
			continue
		}
		budget -= file.bytes.length
		const index =
			attachments.push({
				path: source,
				type: file.type,
				data: sharedNoteBytesToBase64(file.bytes),
			}) - 1
		indexBySource.set(source, index)
	}

	const rewritten = html.replace(IMAGE_SOURCE, (whole, start: string, raw: string, end: string) => {
		const source = decodeAttribute(raw)
		if (!indexBySource.has(source)) return whole
		const index = indexBySource.get(source)
		return index === null || index === undefined
			? `${start}${end}`
			: `${start}cortex-attachment:${index}${end}`
	})
	return { html: rewritten, attachments }
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
