import {
	inlineAttachments,
	saveSharedNoteCopy,
	useVaultStore,
	useWorkspaceStore,
} from "@cortex/core"
import { ReadingView } from "@cortex/editor/reading-view"
import { reserveUniquePath, sanitizeFileStem } from "@cortex/import-export"
import type { SharedNoteBundle } from "@cortex/platform"
import { getPlatform } from "@cortex/platform"
import { Button } from "@cortex/ui"
import { GlobeIcon } from "lucide-react"
import { useState } from "react"
import type { CoreViewProps } from "../split-view/coreViewProps"

function readBundle(value: unknown): SharedNoteBundle | null {
	const bundle = value as SharedNoteBundle | null
	return bundle && bundle.v === 1 && typeof bundle.markdown === "string" ? bundle : null
}

function saveCopy(bundle: SharedNoteBundle, vaultPath: string): Promise<string> {
	return saveSharedNoteCopy(bundle, vaultPath, { sanitizeFileStem, reserveUniquePath })
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
