import {
	getBaseName,
	getVaultIndex,
	normalizeAccessPath,
	toVaultRelativePath,
	useVaultStore,
} from "@cortex/core"
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@cortex/ui"
import { ModalStoreHost } from "@/utils/ModalHost"
import { manageAccessModal } from "@/utils/modals"
import { isVaultAdminRole } from "./memberDirectory"
import { ShareAccessPanel } from "./ShareAccessPanel"
import { useLinkedVaultOverview, useLinkedVaultRole } from "./useLinkedVault"

export function ManageAccessHost() {
	return (
		<ModalStoreHost store={manageAccessModal}>
			{(target) => <ManageAccessContent key={target.filePath} filePath={target.filePath} />}
		</ModalStoreHost>
	)
}

function ManageAccessContent({ filePath }: { filePath: string }) {
	const vaultPath = useVaultStore((state) => state.vault?.path ?? null)
	const isDirectory = useVaultStore(
		(state) => filePath === state.vault?.path || getVaultIndex().get(filePath)?.isDir === true,
	)
	const { vaultId, role } = useLinkedVaultRole()
	useLinkedVaultOverview(vaultId)

	const relativePath =
		vaultPath && filePath !== vaultPath ? toVaultRelativePath(filePath, vaultPath) : null
	const kind = isDirectory ? "folder" : "note"

	return (
		<DialogContent className="share-dialog max-h-[min(720px,calc(100vh-2rem))] overflow-y-auto sm:max-w-[560px]">
			<DialogHeader>
				<DialogTitle>Manage access to “{getBaseName(filePath)}”</DialogTitle>
				<DialogDescription>
					{isDirectory
						? "People in your vault use Cortex to open this folder and everything inside it."
						: "People in your vault use Cortex to open this note."}
				</DialogDescription>
			</DialogHeader>
			{vaultId && relativePath ? (
				<ShareAccessPanel
					vaultId={vaultId}
					path={normalizeAccessPath(relativePath, isDirectory)}
					kind={kind}
					canManage={isVaultAdminRole(role)}
				/>
			) : (
				<p className="share-muted">
					Link this vault to Cortex Sync in Settings → Sync before managing access.
				</p>
			)}
		</DialogContent>
	)
}
