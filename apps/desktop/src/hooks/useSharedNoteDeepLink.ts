import { useWorkspaceStore } from "@cortex/core"
import { getPlatform } from "@cortex/platform"
import { useEffect } from "react"
import { SHARED_NOTE_VIEW_ID } from "../features/sync/sharedNote"

export interface SharedNoteDeepLink {
	shareId: string
	key: string
}

export function parseSharedNoteDeepLink(value: string): SharedNoteDeepLink | null {
	try {
		const url = new URL(value)
		if (url.protocol !== "cortex:" || url.hostname !== "s") return null
		const shareId = decodeURIComponent(url.pathname.replace(/^\/+/, ""))
		const key = new URLSearchParams(url.hash.replace(/^#/, "")).get("k")
		return shareId && key ? { shareId, key } : null
	} catch {
		return null
	}
}

async function openSharedNote({ shareId, key }: SharedNoteDeepLink): Promise<void> {
	const bundle = await getPlatform().shares.open(shareId, key)
	useWorkspaceStore.getState().openViewTab(SHARED_NOTE_VIEW_ID, bundle.title || "Shared note", {
		ephemeral: true,
		viewState: { bundle },
	})
}

function startSharedNoteDeepLinks(): () => void {
	return getPlatform().app.onDeepLinkOpen((urls) => {
		const link = urls.map(parseSharedNoteDeepLink).find((candidate) => candidate !== null)
		if (!link) return
		void openSharedNote(link).catch((error) =>
			getPlatform().dialog.showAlert({
				title: "Could not open the shared note",
				message: error instanceof Error ? error.message : String(error),
				kind: "error",
			}),
		)
	})
}

export function useSharedNoteDeepLink() {
	useEffect(() => startSharedNoteDeepLinks(), [])
}
