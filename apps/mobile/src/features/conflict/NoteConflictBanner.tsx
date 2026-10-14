import { getErrorMessage, useSyncStore } from "@cortex/core"
import { toVaultRelativePath } from "@cortex/platform/utils"
import { useState } from "react"
import { ConflictBannerView } from "@/features/conflict/ConflictBannerView"
import { resolveConflictByPath } from "@/features/conflict/conflictAdapter"
import { toast } from "@/features/feedback/useToast"
import { openConflict } from "@/features/navigation/routes"

async function keepVersion(
	filePath: string,
	vaultPath: string | undefined,
	choice: "local" | "remote",
): Promise<void> {
	try {
		await resolveConflictByPath(filePath, vaultPath, choice)
		toast(choice === "local" ? "Kept your version" : "Kept the other device's version")
	} catch (error) {
		toast(getErrorMessage(error))
	}
}

export function NoteConflictBanner({
	filePath,
	vaultPath,
}: {
	filePath: string | null
	vaultPath: string | undefined
}) {
	const [busy, setBusy] = useState(false)
	const relativePath = filePath && vaultPath ? toVaultRelativePath(filePath, vaultPath) : null
	const conflicted = useSyncStore((state) =>
		relativePath ? Boolean(state.conflicts[relativePath]) : false,
	)
	if (!conflicted || !filePath) return null

	const keep = (choice: "local" | "remote") => {
		setBusy(true)
		void keepVersion(filePath, vaultPath, choice).then(() => setBusy(false))
	}

	return (
		<ConflictBannerView
			busy={busy}
			onCompare={() => openConflict(filePath)}
			onKeepMine={() => keep("local")}
			onKeepTheirs={() => keep("remote")}
		/>
	)
}
