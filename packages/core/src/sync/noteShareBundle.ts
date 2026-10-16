import type { SharedNoteAttachment, SharedNoteBundle } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { getBaseName, getNoteTitle, getParentPath, joinPath } from "@cortex/platform/utils"
import { useAuthStore } from "../stores/authStore"
import { useVaultStore } from "../stores/vaultStore"
import { extractAllTags, parseNoteFrontmatter } from "../utils/frontmatter"

export interface SharedNoteBundleDeps {
	render: (markdown: string) => Promise<string>
	embedImages: (
		html: string,
		notePath: string,
		vaultPath: string,
	) => Promise<{ html: string; attachments: SharedNoteAttachment[] }>
}

export const ATTACHMENT_BUDGET_BYTES = 20 * 1024 * 1024

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

export function imageType(path: string): string | null {
	const extension = path.split(".").pop()?.toLowerCase() ?? ""
	return IMAGE_TYPES[extension] ?? null
}

export function toBase64(bytes: Uint8Array): string {
	let binary = ""
	for (let offset = 0; offset < bytes.length; offset += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
	}
	return btoa(binary)
}

export function isExternalSource(source: string): boolean {
	return /^(https?:|data:|blob:|mailto:)/i.test(source)
}

export function candidatePaths(source: string, notePath: string, vaultPath: string): string[] {
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

export async function readImage(source: string, notePath: string, vaultPath: string) {
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

export async function buildSharedNoteBundle(
	notePath: string,
	{ render, embedImages }: SharedNoteBundleDeps,
): Promise<SharedNoteBundle> {
	const vaultPath = useVaultStore.getState().vault?.path
	if (!vaultPath) throw new Error("Open the vault before sharing a note.")
	const content = await getPlatform().fs.readFile(notePath)
	const markdown = parseNoteFrontmatter(content).body
	const rendered = await render(markdown)
	const { html, attachments } = await embedImages(rendered, notePath, vaultPath)
	return {
		v: 1,
		title: getNoteTitle(notePath),
		markdown,
		html,
		attachments,
		author: useAuthStore.getState().user?.displayName || null,
		tags: extractAllTags(content),
	}
}
