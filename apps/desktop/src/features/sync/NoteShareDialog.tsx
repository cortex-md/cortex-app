import {
	getNoteTitle,
	toVaultRelativePath,
	useMembersStore,
	useNoteSharesStore,
	useServerCapabilities,
	useVaultStore,
} from "@cortex/core"
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@cortex/ui"
import { useEffect } from "react"
import { ModalStoreHost } from "@/utils/ModalHost"
import { noteShareModal } from "@/utils/modals"
import { isVaultAdminRole } from "./memberDirectory"
import { PublicLinkCard } from "./PublicLinkCard"
import { ShareAccessPanel } from "./ShareAccessPanel"
import { useLinkedVaultOverview, useLinkedVaultRole } from "./useLinkedVault"

const SHARING_ROLES = new Set(["owner", "admin", "editor"])

export function NoteShareHost() {
	return (
		<ModalStoreHost store={noteShareModal}>
			{(target) => <NoteShareContent key={target.filePath} filePath={target.filePath} />}
		</ModalStoreHost>
	)
}

function NoteShareContent({ filePath }: { filePath: string }) {
	const vaultPath = useVaultStore((state) => state.vault?.path)
	const overviewVault = useMembersStore((state) => state.overviewVault)
	const fetchShares = useNoteSharesStore((state) => state.fetchShares)
	const capabilities = useServerCapabilities()
	const { vaultId, role } = useLinkedVaultRole()
	useLinkedVaultOverview(vaultId)

	const notePath = vaultPath ? toVaultRelativePath(filePath, vaultPath) : null

	// oxlint-disable-next-line react-doctor/no-event-handler -- public link state loads for the linked vault when the dialog opens
	useEffect(() => {
		if (vaultId) void fetchShares(vaultId).catch(() => {})
	}, [fetchShares, vaultId])

	let blockedReason: string | null = null
	if (capabilities?.features.publicLinks === false)
		blockedReason = "Public links are turned off on this server."
	else if (overviewVault?.allowPublicLinks === false)
		blockedReason = "An admin turned off public links for this vault."
	else if (!role || !SHARING_ROLES.has(role))
		blockedReason = "Only editors and admins can publish notes."

	return (
		<DialogContent className="share-dialog max-h-[min(720px,calc(100vh-2rem))] overflow-y-auto sm:max-w-[560px]">
			<DialogHeader>
				<DialogTitle>Share “{getNoteTitle(filePath)}”</DialogTitle>
				<DialogDescription>
					People in your vault use Cortex to open it. A public link lets anyone read it in a
					browser.
				</DialogDescription>
			</DialogHeader>
			{vaultId && notePath ? (
				<>
					<ShareAccessPanel
						vaultId={vaultId}
						path={notePath}
						kind="note"
						canManage={isVaultAdminRole(role)}
					/>
					<PublicLinkCard
						vaultId={vaultId}
						notePath={notePath}
						filePath={filePath}
						blockedReason={blockedReason}
					/>
				</>
			) : (
				<p className="share-muted">
					Link this vault to Cortex Sync in Settings → Sync before sharing notes.
				</p>
			)}
		</DialogContent>
	)
}
