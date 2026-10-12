import { getBaseName, joinPath, useVaultStore, useWorkspaceStore } from "@cortex/core"
import { ReadingView } from "@cortex/editor/reading-view"
import { reserveUniquePath, sanitizeFileStem } from "@cortex/import-export"
import type { SharedNoteBundle } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { Button } from "@cortex/ui"
import { GlobeIcon } from "lucide-react"
import { useState } from "react"
import type { CoreViewProps } from "../split-view/coreViewProps"
import { inlineAttachments, rewriteAttachmentLinks } from "./sharedNote"

function readBundle(value: unknown): SharedNoteBundle | null {
	const bundle = value as SharedNoteBundle | null
	return bundle && bundle.v === 1 && typeof bundle.markdown === "string" ? bundle : null
}

function fromBase64(data: string): Uint8Array {
	return Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
}

async function saveCopy(bundle: SharedNoteBundle, vaultPath: string): Promise<string> {
	const fs = getPlatform().fs
	const existing = new Set(useVaultStore.getState().files.map((file) => file.path))
	const stem = sanitizeFileStem(bundle.title) || "Shared note"
	const notePath = reserveUniquePath(vaultPath, `${stem}.md`, existing)
	const assetsFolder = `${getBaseName(notePath).replace(/\.md$/, "")} files`
	if (bundle.attachments.length > 0) await fs.createDir(joinPath(vaultPath, assetsFolder))
	const names = new Set<string>()
	const relativePaths = await Promise.all(
		bundle.attachments.map(async (attachment) => {
			const assetPath = reserveUniquePath(
				joinPath(vaultPath, assetsFolder),
				sanitizeFileStem(getBaseName(attachment.path)) || "image",
				names,
			)
			names.add(assetPath)
			await fs.writeBinaryFile(assetPath, fromBase64(attachment.data))
			return `${assetsFolder}/${getBaseName(assetPath)}`
		}),
	)
	await fs.writeFile(
		notePath,
		rewriteAttachmentLinks(bundle, (index) => relativePaths[index] ?? ""),
	)
	await useVaultStore.getState().refreshFiles()
	return notePath
}

export function SharedNoteView({ viewState }: CoreViewProps) {
	const bundle = readBundle(viewState.bundle)
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const [status, setStatus] = useState<string | null>(null)
	if (!bundle) return null

	const save = () => {
		if (!vaultPath) return
		setStatus(null)
		void saveCopy(bundle, vaultPath)
			.then((path) => useWorkspaceStore.getState().openTab(path))
			.catch((error) => setStatus(error instanceof Error ? error.message : String(error)))
	}

	return (
		<div className="note-document-scroll">
			<div className="shared-note-banner">
				<GlobeIcon />
				<span>{status ?? "Shared note · read only"}</span>
				{vaultPath && (
					<Button variant="secondary" size="xs" onClick={save}>
						Save a copy to this vault
					</Button>
				)}
			</div>
			<div className="note-document-surface">
				<ReadingView
					content={inlineAttachments(bundle)}
					scrollMode="parent"
					onExternalLinkClick={(url) => {
						void getPlatform().app.openExternalUrl(url)
					}}
				/>
			</div>
		</div>
	)
}
