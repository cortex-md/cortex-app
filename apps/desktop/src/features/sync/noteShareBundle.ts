import {
	getBaseName,
	getNoteTitle,
	getParentPath,
	joinPath,
	parseFrontmatter,
	useVaultStore,
} from "@cortex/core"
import type { SharedNoteAttachment, SharedNoteBundle } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"

const ATTACHMENT_BUDGET_BYTES = 20 * 1024 * 1024

const IMAGE_TYPES: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	avif: "image/avif",
	bmp: "image/bmp",
	svg: "image/svg+xml",
}

function imageType(path: string): string | null {
	const extension = path.split(".").pop()?.toLowerCase() ?? ""
	return IMAGE_TYPES[extension] ?? null
}

function toBase64(bytes: Uint8Array): string {
	let binary = ""
	for (let offset = 0; offset < bytes.length; offset += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
	}
	return btoa(binary)
}

function isExternalSource(source: string): boolean {
	return /^(https?:|data:|blob:|mailto:)/i.test(source)
}

function candidatePaths(source: string, notePath: string, vaultPath: string): string[] {
	const decoded = decodeURIComponent(source.replace(/^cortex-file:\/\/local/, "")).replace(
		/^\.\//,
		"",
	)
	const candidates = decoded.startsWith(vaultPath)
		? [decoded]
		: [joinPath(getParentPath(notePath), decoded), joinPath(vaultPath, decoded)]
	const name = getBaseName(decoded)
	for (const file of useVaultStore.getState().files) {
		if (!file.isDir && file.name === name) candidates.push(file.path)
	}
	return [...new Set(candidates)]
}

async function readImage(source: string, notePath: string, vaultPath: string) {
	const fs = getPlatform().fs
	if (!fs.readBinaryFile) return null
	for (const path of candidatePaths(source, notePath, vaultPath)) {
		const type = imageType(path)
		if (!type) continue
		try {
			return { type, bytes: await fs.readBinaryFile(path) }
		} catch {}
	}
	return null
}

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
	const vaultPath = useVaultStore.getState().vault?.path
	if (!vaultPath) throw new Error("Open the vault before sharing a note.")
	const content = await getPlatform().fs.readFile(notePath)
	const markdown = parseFrontmatter(content).body
	const { createRenderer } = await import("@cortex/renderer/pipeline")
	const rendered = await createRenderer({ surface: "export" }).render(markdown)
	const { html, attachments } = await embedImages(rendered, notePath, vaultPath)
	return { v: 1, title: getNoteTitle(notePath), markdown, html, attachments }
}
